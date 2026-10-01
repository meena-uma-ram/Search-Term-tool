import { useCallback, useEffect, useState } from "react";
import { resolveConfig, type RuleConfig } from "../engine";
import type { Account } from "../shared/api";

const key = (accountId: string) => `stc:rules:${accountId}`;

function load(account: Account | null): RuleConfig {
  if (account) {
    try {
      const raw = localStorage.getItem(key(account.id));
      if (raw) return resolveConfig(JSON.parse(raw) as Partial<RuleConfig>);
    } catch {
      // ignore unreadable storage
    }
  }
  return resolveConfig(account?.suggestedConfig);
}

/** Rule settings (brand list, thresholds, ...) persisted per account in this browser. */
export function useRuleConfig(account: Account | null) {
  const [config, setConfig] = useState<RuleConfig>(() => load(account));

  useEffect(() => setConfig(load(account)), [account]);

  const update = useCallback(
    (next: RuleConfig) => {
      setConfig(next);
      if (account) {
        try {
          localStorage.setItem(key(account.id), JSON.stringify(next));
        } catch {
          // storage full or blocked: keep in memory only
        }
      }
    },
    [account],
  );

  const reset = useCallback(() => {
    if (account) {
      try {
        localStorage.removeItem(key(account.id));
      } catch {
        // ignore
      }
    }
    setConfig(resolveConfig(account?.suggestedConfig));
  }, [account]);

  return { config, update, reset };
}
