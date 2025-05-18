// frontend/src/lib/navigationLock.ts
export interface LockState {
  isLocked: boolean;
  message: string;
  title: string;
}

// Default state for the lock
const currentLockState: LockState = {
  isLocked: false,
  message: "Navigating away will interrupt the current process. Any progress will be lost.",
  title: "Are you sure you want to leave?",
};

// Callback to be set by the UI layer (e.g., ClientLayout) to show a global modal
let showGlobalModalFn: ((
  title: string,
  message: string,
  onConfirm: () => void,
  onCancel: () => void
) => void) | null = null;

export const navigationGuard = {
  /**
   * Sets the navigation lock state. Called by components like VideoCreator.
   * @param locked - Whether navigation should be locked.
   * @param title - Optional title for the confirmation modal.
   * @param message - Optional message for the confirmation modal.
   */
  setLock: (
    locked: boolean,
    title?: string,
    message?: string,
  ) => {
    currentLockState.isLocked = locked;
    if (title) currentLockState.title = title;
    if (message) currentLockState.message = message;
    console.log('[NavigationGuard] Lock set to:', currentLockState.isLocked, {title: currentLockState.title, message: currentLockState.message});
  },

  /**
   * Checks if navigation is currently locked.
   */
  isLocked: (): boolean => {
    return currentLockState.isLocked;
  },

  /**
   * Gets the content for the confirmation modal.
   */
  getModalContent: (): { title: string; message: string } => {
    return { title: currentLockState.title, message: currentLockState.message };
  },

  /**
   * Registers a function that can display a global confirmation modal.
   * This should be called by your root layout component.
   */
  registerShowModalFunction: (
    showModal: (title: string, message: string, onConfirm: () => void, onCancel: () => void) => void
  ) => {
    showGlobalModalFn = showModal;
  },

  /**
   * Unregisters the global modal function.
   */
  unregisterShowModalFunction: () => {
    showGlobalModalFn = null;
  },

  /**
   * Attempts to navigate. If locked and a global modal function is registered,
   * it will call the modal function. Otherwise, it falls back to window.confirm
   * or navigates directly if not locked.
   * @param path - The path to navigate to.
   * @param routerPush - The router.push function.
   */
  attemptNavigation: (path: string, routerPush: (path: string) => void) => {
    if (currentLockState.isLocked) {
      console.log('[NavigationGuard] Attempting protected navigation to:', path);
      if (showGlobalModalFn) {
        showGlobalModalFn(
          currentLockState.title,
          currentLockState.message,
          () => { // onConfirm
            console.log('[NavigationGuard] Global navigation confirmed for:', path);
            navigationGuard.setLock(false); // Temporarily unlock
            routerPush(path);
            // The lock might be re-applied by VideoCreator's useEffect if it's still in a critical state
            // and the navigation was to a page where VideoCreator is not active or re-mounts.
          },
          () => { // onCancel
            console.log('[NavigationGuard] Global navigation cancelled for:', path);
          }
        );
      } else {
        // Fallback if no global modal is registered (less ideal)
        console.warn('[NavigationGuard] Navigation locked, but no global modal trigger registered. Using window.confirm as fallback.');
        if (window.confirm(`${currentLockState.title}\n\n${currentLockState.message}\n\nProceed to ${path}?`)) {
          navigationGuard.setLock(false); // Temporarily unlock
          routerPush(path);
        }
      }
    } else {
      console.log('[NavigationGuard] Navigation allowed to:', path);
      routerPush(path);
    }
  },
}; 