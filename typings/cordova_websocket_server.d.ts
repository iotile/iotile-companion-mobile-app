// Type definitions for Apache Cordova Websocket Server plugin
// Project: https://github.com/becvert/cordova-plugin-websocket-server

interface cordova {
    plugins: {
        wsserve: WebSocketServer;
    }
}

interface WebSocketConnection {
    uuid: string;
    remoteAddr: string;
    httpFields: {[key:string]: string};
    resource: string;
}

interface NetworkInterface {
    ipv4Addresses: string[],
    ipv6Addresses: string[]
}

interface WebSocketServerOptions {
    onFailure: (address: string, port: number, reason: string) => (void | Promise<void>),
    onOpen: (connection: WebSocketConnection) => (void | Promise<void>),
    onMessage: (connection: WebSocketConnection, msg: string) => (void | Promise<void>),
    onClose: (connection: WebSocketConnection, code: number, reason: string, wasClean: boolean) => (void | Promise<void>),
    
    origins?: string[],
    protocols?: string[],
    tcpNoDelay?: boolean,
}

/**
 * This plugin provides an API for taking pictures and for choosing images from the system's image library.
 */
interface WebSocketServer {
    start(port: number, 
          options: WebSocketServerOptions, 
          success?: (address: string, port: number) => void,
          failure?: (reason: string) => void): void;

    stop(success?: (address: string, port: number) => void,
        failure?: (reason: string) => void): void;
    
    send(conn: WebSocketConnection, msg: string): void;
    close(conn: WebSocketConnection, code?: number, reason?: string): void;
    getInterfaces(callback: (interfaces: NetworkInterface[]) => void);
}