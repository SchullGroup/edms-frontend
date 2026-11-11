'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUIStore } from '@/store/useUIStore';
import { useCreateAccessRule } from '@/apis/hooks/useAccessRules';
import { countryOptions, describeRule } from '@/components/accessRules/accessRuleLabels';
import type { AccessRuleEffect, AccessRuleType } from '@/types/models';

const IPV4 = /^(\d{1,3})(\.\d{1,3}){3}(\/\d{1,2})?$/;
const IPV6 = /^[0-9a-f:]+(\/\d{1,3})?$/i;

/** A quick shape check; the server has the final say (it accepts IPv4/IPv6, with or without a range). */
function looksLikeIp(value: string) {
  const v = value.trim();
  if (IPV4.test(v))
    return v
      .split('/')[0]
      .split('.')
      .every((n) => Number(n) <= 255);
  return v.includes(':') && IPV6.test(v);
}

/** Adds one IP or country rule. Its own page, not a modal. */
export default function NewAccessRulePage() {
  const router = useRouter();
  const { setPageTitle } = useUIStore();
  const createRule = useCreateAccessRule();

  const [ruleType, setRuleType] = useState<AccessRuleType>('ip');
  const [effect, setEffect] = useState<AccessRuleEffect>('deny');
  const [ip, setIp] = useState('');
  const [country, setCountry] = useState('');
  const [description, setDescription] = useState('');
  const [showErrors, setShowErrors] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  // Learnt from the first refusal: no endpoint says whether the server has a geo header.
  const [geoOff, setGeoOff] = useState(false);

  const countries = useMemo(() => countryOptions(), []);

  useEffect(() => {
    setPageTitle('Add access rule');
  }, [setPageTitle]);

  const value = ruleType === 'ip' ? ip.trim() : country;
  const valueError =
    ruleType === 'ip'
      ? !ip.trim()
        ? 'Enter an IP address or range.'
        : looksLikeIp(ip)
          ? null
          : 'Enter an address such as 203.0.113.7, or a range such as 10.0.0.0/8.'
      : !country
        ? 'Pick a country.'
        : null;

  const submit = async () => {
    setServerError(null);
    if (valueError || (ruleType === 'country' && geoOff)) {
      setShowErrors(true);
      return;
    }
    try {
      await createRule.mutateAsync({
        ruleType,
        effect,
        value,
        description: description.trim() || undefined,
      });
      router.push('/admin/access-rules');
    } catch (err: any) {
      const code = err?.response?.data?.code;
      if (code === 'GEO_NOT_CONFIGURED') setGeoOff(true);
      setServerError(
        code === 'WOULD_LOCK_OUT_CALLER'
          ? 'Not added: this rule would block your own connection, and then nobody could remove it from here.'
          : code === 'GEO_NOT_CONFIGURED'
            ? null
            : code === 'CONFLICT'
              ? 'That rule already exists.'
              : err?.response?.data?.message || 'The rule could not be added.',
      );
    }
  };

  const preview = value ? describeRule({ ruleType, effect, value: value.toUpperCase() }) : null;

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">Add an access rule</div>
          <div className="page-sub">
            Takes effect on the next request. Removing it undoes it, from the rules page.
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 640 }}>
        <div className="card mb-4">
          <div className="card-body">
            <div className="field">
              <label htmlFor="ar-effect">Effect</label>
              <select
                id="ar-effect"
                className="input"
                value={effect}
                onChange={(e) => setEffect(e.target.value as AccessRuleEffect)}
              >
                <option value="deny">Block: turn this away</option>
                <option value="allow">Allow: turn away everything else</option>
              </select>
            </div>
            {effect === 'allow' && (
              <div className="banner warning mb-4">
                An allow rule makes an allow list: every {ruleType === 'ip' ? 'address' : 'country'}{' '}
                it doesn’t name is turned away, other admins and staff included.
                {ruleType === 'ip' &&
                  ' Include the web app server’s address too, or nobody can sign in: sign-in reaches the API from that server, not from the user’s browser.'}
              </div>
            )}

            <div className="field">
              <label htmlFor="ar-type">Applies to</label>
              <select
                id="ar-type"
                className="input"
                value={ruleType}
                onChange={(e) => {
                  setRuleType(e.target.value as AccessRuleType);
                  setShowErrors(false);
                  setServerError(null);
                }}
              >
                <option value="ip">An IP address or range</option>
                <option value="country" disabled={geoOff}>
                  A country{geoOff ? ' (not set up on this server)' : ''}
                </option>
              </select>
            </div>

            {ruleType === 'ip' ? (
              <div className="field">
                <label htmlFor="ar-ip">
                  IP address or range <span className="req">*</span>
                </label>
                <input
                  id="ar-ip"
                  className="input"
                  value={ip}
                  placeholder="203.0.113.7 or 10.0.0.0/8"
                  onChange={(e) => setIp(e.target.value)}
                />
                {showErrors && valueError && <div className="err">{valueError}</div>}
              </div>
            ) : (
              <div className="field">
                <label htmlFor="ar-country">
                  Country <span className="req">*</span>
                </label>
                <select
                  id="ar-country"
                  className="input"
                  value={country}
                  disabled={geoOff}
                  onChange={(e) => setCountry(e.target.value)}
                >
                  <option value="">Select a country…</option>
                  {countries.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </select>
                {showErrors && valueError && <div className="err">{valueError}</div>}
                {geoOff && (
                  <div className="err">
                    This server can’t tell which country a request comes from, so it refuses country
                    rules. Ask whoever runs the API to set GEO_COUNTRY_HEADER.
                  </div>
                )}
              </div>
            )}

            <div className="field">
              <label htmlFor="ar-note">Note</label>
              <input
                id="ar-note"
                className="input"
                maxLength={255}
                value={description}
                placeholder="Why this rule exists, e.g. head office network"
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {preview && <p className="caption">Will add: {preview}</p>}
            {serverError && <div className="banner error mt-2">{serverError}</div>}
          </div>
        </div>

        <div className="flex gap-2" style={{ justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => router.push('/admin/access-rules')}
            disabled={createRule.isPending}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={submit}
            disabled={createRule.isPending}
          >
            {createRule.isPending && <span className="btn-spinner" aria-hidden="true" />}
            Add rule
          </button>
        </div>
      </div>
    </div>
  );
}
