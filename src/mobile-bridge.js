import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { StatusBar, Style } from '@capacitor/status-bar';

// Keep the ordinary website unaffected. Native behavior runs only inside Capacitor.
if (Capacitor.isNativePlatform()) {
  // APLEX uses a dark cinema interface, so show a light status-bar foreground.
  StatusBar.setStyle({ style: Style.Dark }).catch(() => {});

  // Android back button: close an open dialog first, otherwise navigate back.
  App.addListener('backButton', ({ canGoBack }) => {
    const dialogs = [...document.querySelectorAll('dialog[open]')];
    if (dialogs.length) {
      dialogs[dialogs.length - 1].close();
      return;
    }
    if (canGoBack && window.history.length > 1) {
      window.history.back();
    } else {
      App.exitApp();
    }
  });

  // Open links explicitly marked as new tabs in Capacitor's in-app browser.
  document.addEventListener('click', async (event) => {
    const anchor = event.target?.closest?.('a[target="_blank"]');
    if (!anchor || !anchor.href) return;

    let destination;
    try {
      destination = new URL(anchor.href);
    } catch {
      return;
    }
    if (!['https:', 'http:'].includes(destination.protocol)) return;

    event.preventDefault();
    event.stopPropagation();
    try {
      await Browser.open({ url: destination.href, toolbarColor: '#090A0F' });
    } catch (error) {
      console.warn('Could not open external page:', error);
    }
  }, true);
}
