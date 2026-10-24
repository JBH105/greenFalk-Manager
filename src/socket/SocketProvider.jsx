import { createContext, useContext } from 'react';
import { getSocket } from './socket';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const socket = getSocket();

  console.log('SocketProvider rendered, socket id:', socket.id);

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const socket = useContext(SocketContext);
  if (!socket) throw new Error('Socket not initialized');
  return socket;
};
