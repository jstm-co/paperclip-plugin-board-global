// Selector de idioma (JST-409): un botón en la cabecera de las dos páginas. La
// elección se guarda en este navegador; «El del navegador» la borra. Cambiar de
// idioma recarga la página, porque el idioma se fija una vez al cargar.
import { useState } from "react";
import { LOCALES, detectLocale, getLocale, storeLocale, storedLocale, t, type Locale } from "../i18n.js";
import { cx } from "./common.js";
import { Icon } from "./icons.js";
import { Popover } from "./layer.js";

export function LanguageButton() {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [chosen, setChosen] = useState<Locale | null>(() => storedLocale());
  const current = LOCALES.find((locale) => locale.id === getLocale())!;
  const choose = (locale: Locale | null) => {
    setAnchor(null);
    storeLocale(locale);
    setChosen(locale);
    // Si el idioma que resulta es el que ya se ve, no hace falta recargar.
    if (detectLocale() !== getLocale()) window.location.reload();
  };
  const label = t("Idioma: {name}", { name: current.name });
  return (
    <>
      <button
        type="button"
        className={cx("gb-btn is-icon gb-langbtn", anchor && "is-active")}
        title={label}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={anchor !== null}
        onClick={(event) => setAnchor(anchor ? null : event.currentTarget)}
      >
        <Icon name="globe" size={14} />
      </button>
      {anchor ? (
        <Popover anchor={anchor} width={210} align="end" label={t("Idioma")} onClose={() => setAnchor(null)}>
          <div className="gb-mh">{t("Idioma")}</div>
          <button type="button" className="gb-mi" role="menuitemradio" aria-checked={chosen === null} onClick={() => choose(null)}>
            <span className="gb-ck">{chosen === null ? <Icon name="check" size={14} /> : null}</span>
            <span className="gb-lbl">{t("El del navegador")}</span>
          </button>
          <div className="gb-msep" />
          {/* Cada idioma con su propio nombre, para reconocerlo aunque la interfaz esté en otro. */}
          {LOCALES.map((locale) => (
            <button key={locale.id} type="button" className="gb-mi" role="menuitemradio" aria-checked={chosen === locale.id} lang={locale.id} onClick={() => choose(locale.id)}>
              <span className="gb-ck">{chosen === locale.id ? <Icon name="check" size={14} /> : null}</span>
              <span className="gb-lbl">{locale.name}</span>
            </button>
          ))}
        </Popover>
      ) : null}
    </>
  );
}
