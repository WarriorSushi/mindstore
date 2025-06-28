// Browser API type extensions
export {};

declare global {
  interface Navigator {
    mediaDevices?: MediaDevices;
    permissions?: Permissions;
  }
  
  interface Permissions {
    query(permissionDesc: PermissionDescriptor): Promise<PermissionStatus>;
  }
  
  interface PermissionStatus {
    state: PermissionState;
    onchange: ((this: PermissionStatus, ev: Event) => any) | null;
  }
  
  type PermissionState = 'granted' | 'denied' | 'prompt';
  
  interface PermissionDescriptor {
    name: PermissionName;
  }
  
  type PermissionName = 'microphone' | 'camera' | 'geolocation' | 'notifications' | 'persistent-storage' | 'push' | 'screen-wake-lock';
} 