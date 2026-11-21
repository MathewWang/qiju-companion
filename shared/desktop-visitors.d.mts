export type DesktopVisitorInfo={id:string;hostId:string;from:string;name:string;skin:string;note:string;url:string;expiresAt:number};
export function desktopVisitors(state:unknown,now?:number):DesktopVisitorInfo[];
