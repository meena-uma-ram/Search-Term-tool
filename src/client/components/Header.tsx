import type { StatusResponse } from "../../shared/api";
import { api, runtime } from "../api";

interface Props {
  status: StatusResponse | null;
  onDisconnect: () => void;
}

export function Header({ status, onDisconnect }: Props) {
  return (
    <header className="header">
      <div>
        <h1>Search Terms Cleaner</h1>
        <p className="subtitle">Find search terms worth a negative-keyword review. Read-only: nothing is changed in Google Ads.</p>
      </div>
      <div className="header-actions">
        {status?.connected ? (
          <>
            <span className="status-pill status-connected">● Google Ads connected</span>
            <button className="btn btn-secondary" onClick={onDisconnect}>
              Disconnect
            </button>
          </>
        ) : (
          <a
            className={`btn btn-primary${status && !status.googleAdsConfigured ? " is-disabled" : ""}`}
            href={api.connectUrl}
            aria-disabled={status ? !status.googleAdsConfigured : undefined}
            title={
              runtime.standalone
                ? "Not available in this preview. Run the app locally to connect Google Ads."
                : status && !status.googleAdsConfigured
                  ? "Google Ads credentials are not configured on the server"
                  : undefined
            }
            onClick={(e) => {
              if (status && !status.googleAdsConfigured) e.preventDefault();
            }}
          >
            Connect Google Ads
          </a>
        )}
      </div>
    </header>
  );
}
