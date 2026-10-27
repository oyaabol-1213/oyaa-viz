(function addOyaaVizTopbarButton(attempts = 0) {
  if (!Spicetify.Topbar || !Spicetify.Topbar.Button || !Spicetify.Platform || !Spicetify.Platform.History) {
    if (attempts < 40) setTimeout(() => addOyaaVizTopbarButton(attempts + 1), 250);
    return;
  }
  if (window.__oyaaVizTopbarButton) return;

  const icon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 10h2v4H2zm3-4h2v12H5zm3-3h2v18H8zm3-2h2v22h-2zm3 2h2v18h-2zm3 3h2v12h-2zm3 4h2v4h-2z"/></svg>';
  window.__oyaaVizTopbarButton = new Spicetify.Topbar.Button(
    "Oyaa Viz",
    icon,
    () => Spicetify.Platform.History.push({ pathname: "/oyaa-viz" }),
    false,
    true
  );
})();
