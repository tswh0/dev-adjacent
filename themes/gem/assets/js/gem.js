const closeMenus = () => {
  document.querySelectorAll('.gem-dropdown.is-open').forEach(m => m.classList.remove('is-open'));
  document.querySelectorAll('[data-menu][aria-expanded="true"]').forEach(b => { b.classList.remove('is-open'); b.setAttribute('aria-expanded', 'false'); });
};
document.querySelectorAll('[data-menu]').forEach(btn => {
  btn.addEventListener('click', event => {
    event.stopPropagation();
    const menu = document.getElementById(btn.dataset.menu);
    const wasOpen = menu.classList.contains('is-open');
    closeMenus();
    if (!wasOpen) { menu.classList.add('is-open'); btn.classList.add('is-open'); btn.setAttribute('aria-expanded', 'true'); }
  });
});
document.addEventListener('click', closeMenus);
document.addEventListener('keydown', event => { if (event.key === 'Escape') closeMenus(); });

const tos4 = document.getElementById('tos4');
if (tos4) {
  const themeColor = document.querySelector('meta[name="theme-color"]');
  const applyTheme = () => {
    document.body.classList.toggle('gem--3d', tos4.checked);
    themeColor.content = tos4.checked ? '#00aaa9' : '#00e000';
  };
  tos4.addEventListener('change', applyTheme);
  applyTheme();
}
