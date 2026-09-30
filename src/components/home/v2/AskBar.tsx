import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import type { Messages } from "@/lib/i18n/messages/en";

/** Plain GET form → /math-solver?q=… (works without JS); the camera opens the solver's photo picker. */
export function AskBar({ t }: { t: Messages["home"] }) {
  return (
    <form className="v2-ask glass" action="/math-solver" method="get" role="search">
      <Link href="/math-solver?photo=1" className="v2-ask-photo" aria-label={t.askPhoto} title={t.askPhoto}>
        <Icon name="camera" size={20} />
      </Link>
      <label className="sr-only" htmlFor="v2-ask-q">
        {t.askLabel}
      </label>
      <input id="v2-ask-q" name="q" type="text" dir="auto" autoComplete="off" placeholder={t.askPlaceholder} maxLength={500} />
      <button type="submit" className="v2-ask-send" aria-label={t.askSubmit} title={t.askSubmit}>
        <Icon name="send" size={20} />
      </button>
    </form>
  );
}
