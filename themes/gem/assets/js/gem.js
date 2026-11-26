const menuButtons = [...document.querySelectorAll('[data-menu]')];
let openTrigger = null;

const closeMenus = (returnFocus = false) => {
  const trigger = openTrigger;
  document.querySelectorAll('.gem-dropdown.is-open').forEach(menu => menu.classList.remove('is-open'));
  menuButtons.forEach(button => { button.classList.remove('is-open'); button.setAttribute('aria-expanded', 'false'); });
  openTrigger = null;
  if (returnFocus && trigger) trigger.focus();
};

menuButtons.forEach(button => {
  button.addEventListener('click', event => {
    event.stopPropagation();
    const menu = document.getElementById(button.dataset.menu);
    if (!menu) return;
    const wasOpen = menu.classList.contains('is-open');
    closeMenus();
    if (!wasOpen) {
      menu.classList.add('is-open');
      button.classList.add('is-open');
      button.setAttribute('aria-expanded', 'true');
      openTrigger = button;
    }
  });
});

document.addEventListener('click', () => closeMenus());
document.addEventListener('keydown', event => { if (event.key === 'Escape') closeMenus(true); });

const tos4 = document.getElementById('tos4');
const themeColor = document.querySelector('meta[name="theme-color"]');
const themeToggles = [...document.querySelectorAll('[data-theme-toggle]')];

const setTos4 = (checked, persist = true) => {
  if (tos4) tos4.checked = checked;
  document.body.classList.toggle('gem--3d', checked);
  if (themeColor) themeColor.content = checked ? '#00aaa9' : '#00e000';
  themeToggles.forEach(button => button.setAttribute('aria-pressed', String(checked)));
  if (persist) {
    try { localStorage.setItem('gem-tos4', checked ? '1' : '0'); } catch (error) {}
  }
};

let stored = null;
try { stored = localStorage.getItem('gem-tos4'); } catch (error) {}
if (stored !== null || tos4) setTos4(stored === null ? true : stored === '1', false);
if (tos4) tos4.addEventListener('change', () => setTos4(tos4.checked));
themeToggles.forEach(button => button.addEventListener('click', event => {
  event.stopPropagation();
  setTos4(!document.body.classList.contains('gem--3d'));
  closeMenus(true);
}));
