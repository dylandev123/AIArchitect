/**
 * Build-time plugin manifest. It contains no engine logic; each plugin self-registers when imported.
 * Next bundles static modules, so this is the single discovery boundary rather than a filesystem scan at runtime.
 */
import "./corner-glazing/plugin";
import "./roof-expression/plugin";
import "./bridge-masses/plugin";
import "./courtyard-edge-wall/plugin";
import "./entry-canopy/plugin";
import "./brise-soleil/plugin";
import "./pilotis/plugin";
