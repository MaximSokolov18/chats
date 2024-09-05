'use client';
import React, {useCallback, useEffect, useRef, useState} from 'react';

export const Page = ({}: Props) => {
    const socket = useRef<WebSocket | null>(null);
    const messagesRef = useRef<Array<string>>([]);
    const [messages, setMessages] = useState<Array<string>>([]);

    const onAddMessage = useCallback(() => {
        const message = document.getElementsByClassName('message-input')[0].value;

        messagesRef.current.push(message);
        setMessages([...messagesRef.current]);
        socket.current.send(JSON.stringify(message));
    }, [messages]);

    useEffect(() => {
        if (!socket.current) {
            const host = window.location.host.split(':')[0];
            const ws = new WebSocket(`ws://${host}:3001`);
            socket.current = ws;

            ws.addEventListener('message', (event) => {
                messagesRef.current.push(JSON.parse(event.data));
                setMessages([...messagesRef.current]);
            });
        }
    }, []);

    return (
        <div className="flex justify-center items-center flex-col px-4 py-10 h-screen">
            <div className="w-full h-1/2 py-10">
                <div className="messages w-1/3 h-full overflow-auto">
                    {messages.map((message, i) => (<div key={message + i} className="w-full">{message}</div>))}
                </div>
                <div className="w-full flex">
                    <input type="text" className="message-input block w-full rounded-md border-0 px-5 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"/>
                    <button onClick={onAddMessage}
                            className="rounded-md border shadow-lg shadow-emerald-500/50 border-transparent bg-emerald-500 px-8 py-3 text-center font-medium text-white hover:bg-emerald-600 active:bg-emerald-700">
                        Send
                    </button>
                </div>
            </div>
        </div>
    );
};

type Props = {};

export default Page;
