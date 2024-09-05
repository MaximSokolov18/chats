'use client';
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {Socket} from 'socket.io-client/build/esm/socket';
import io from 'socket.io-client';

type OfferObj = {offer: RTCSessionDescription, answer: string};

const userName = `${Math.floor(Math.random() * 100000)}`;

const peerConfiguration = {
    iceServers:[
        {
            urls:[
                'stun:stun.l.google.com:19302',
                'stun:stun1.l.google.com:19302'
            ]
        }
    ]
}

export const Page = ({}: Props) => {
    const [offers, setOffers] = useState<Array<OfferObj>>([]);
    const [didIOffer, setDidIOffer] = useState(false);
    const localVideoElementRef = useRef<HTMLVideoElement | null>(null);
    const localVideoStreamRef = useRef<MediaStream>();

    const remoteVideoElementRef = useRef(null);
    const remoteVideoStreamRef = useRef<MediaStream | null>(null);

    const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
    const socketRef = useRef<Socket>();

    useEffect(() => {
        if (!socketRef.current) {
            const host = window.location.host.split(':')[0];
            socketRef.current = io(`http://${host}:3001`, {
                auth: {userName, password: 'fasd'},
                secure: true,
                rejectUnauthorized: false
            });

            socketRef.current?.on('availableOffers', offers => {
                console.log(offers);
                setOffers(currentOffers => currentOffers.concat(offers));
            });

            socketRef.current?.on('newOfferAwaiting', offers => {
                setOffers(currentOffers => currentOffers.concat(offers));
            });

            socketRef.current?.on('answerResponse', offerObj => {
                console.log(offerObj);
                addAnswer(offerObj);
            });

            socketRef.current?.on('receivedIceCandidateFromServer', iceCandidate => {
                addNewIceCandidate(iceCandidate);
                console.log(iceCandidate);
            });
        }
    }, []);

    const call = useCallback(async () => {
        await getUserMedia();

        await createPeerConnection();

        try {
            console.log('Creating offer...');
            const offer = await peerConnectionRef.current?.createOffer();
            console.log(offer);
            peerConnectionRef.current?.setLocalDescription(offer);
            setDidIOffer(true);
            socketRef.current?.emit('newOffer', offer);
        } catch (err) {
            console.log(err);
        }
    }, []);

    const answerOffer = useCallback(async (offerObj: OfferObj) => {
        await getUserMedia();
        await createPeerConnection(offerObj);
        const answer = await peerConnectionRef.current?.createAnswer({}); //just to make the docs happy
        await peerConnectionRef.current?.setLocalDescription(answer); //this is CLIENT2, and CLIENT2 uses the answer as the localDesc
        console.log(offerObj);
        console.log(answer);
        // console.log(peerConnection.signalingState) //should be have-local-pranswer because CLIENT2 has set its local desc to it's answer (but it won't be)
        //add the answer to the offerObj so the server knows which offer this is related to
        offerObj.answer = answer;
        //emit the answer to the signaling server, so it can emit to CLIENT1
        //expect a response from the server with the already existing ICE candidates
        const offerIceCandidates = await socketRef.current?.emitWithAck('newAnswer', offerObj);
        if (offerIceCandidates) {
            offerIceCandidates?.forEach(c => {
                peerConnectionRef.current?.addIceCandidate(c);
                console.log('======Added Ice Candidate======');
            });
            console.log(offerIceCandidates);
        }
    }, []);

    const getUserMedia = useCallback(async () => {
        const constraints = {
            video: true,
            audio: true,
        };

        try {
            const stream = await navigator.mediaDevices.getUserMedia(constraints)

            localVideoElementRef.current.srcObject = stream;
            localVideoElementRef.current?.play();
            localVideoStreamRef.current = stream;
        } catch (error) {
            console.error('Error accessing media devices:', error);
        }
    }, []);

    const createPeerConnection = useCallback(async (offerObj: OfferObj) => {
        peerConnectionRef.current = await new RTCPeerConnection(peerConfiguration);
        remoteVideoStreamRef.current = new MediaStream();
        remoteVideoElementRef.current.srcObject = remoteVideoStreamRef.current;

        localVideoStreamRef.current?.getTracks().forEach(track => {
            const localStream = localVideoStreamRef.current;

            if (localStream) {
                peerConnectionRef.current?.addTrack(track, localStream);
            }
        })

        const peerConnection = peerConnectionRef.current;

        if (peerConnection) {
            peerConnection.addEventListener("signalingstatechange", (event) => {
                console.log(event);
                console.log(peerConnection.signalingState)
            });

            peerConnection.addEventListener('icecandidate', e => {
                console.log('........Ice candidate found!......');
                console.log(e);
                if (e.candidate) {
                    socketRef.current?.emit('sendIceCandidateToSignalingServer', {
                        iceCandidate: e.candidate,
                        iceUserName: userName,
                        didIOffer
                    });
                }
            })

            peerConnection.addEventListener('track', e => {
                console.log('Got a track from the other peer!! How excting');
                console.log(e);

                e.streams[0].getTracks().forEach(track => {
                    remoteVideoStreamRef.current?.addTrack(track);
                    console.log('Here\'s an exciting moment... fingers cross');
                });
            });

            if(offerObj){
                await peerConnection.setRemoteDescription(offerObj.offer)
            }
        }
    }, [didIOffer]);

    const addAnswer = useCallback(async (offerObj: OfferObj) => {
        //addAnswer is called in socketListeners when an answerResponse is emitted.
        //at this point, the offer and answer have been exchanged!
        //now CLIENT1 needs to set the remote
        await peerConnectionRef.current?.setRemoteDescription(offerObj.answer);
        // console.log(peerConnection.signalingState)
    }, []);

    const addNewIceCandidate = useCallback((iceCandidate: RTCIceCandidateInit)=>{
        peerConnectionRef.current?.addIceCandidate(iceCandidate)
        console.log("======Added Ice Candidate======")
    }, [])

    // const onShow = useCallback(() => {
    //     const host = window.location.host.split(':')[0];
    //     socketRef.current = io(`http://${host}:3001`);
    //
    //     socketRef.current?.emit('join-room', {id: '1231', message: 'message'});
    // }, []);

    return (
        <div className="flex justify-center items-center flex-col px-4 py-10 h-screen">
            <div className="w-full h-1/2 py-10">
                {offers.map((offer) => (
                    <button onClick={() => answerOffer(offer)}
                            className="rounded-md border shadow-lg shadow-emerald-500/50 border-transparent bg-emerald-500 px-8 py-3 text-center font-medium text-white hover:bg-emerald-600 active:bg-emerald-700">
                        answer
                    </button>
                ))}
                <div className="messages w-1/3 h-full overflow-auto">
                    <video ref={localVideoElementRef} autoPlay playsInline muted></video>
                    <video ref={remoteVideoElementRef} autoPlay playsInline muted></video>
                </div>
                <button onClick={call}
                        className="rounded-md border shadow-lg shadow-emerald-500/50 border-transparent bg-emerald-500 px-8 py-3 text-center font-medium text-white hover:bg-emerald-600 active:bg-emerald-700">
                    Call
                </button>
                {/*<button onClick={onStream}*/}
                {/*        className="rounded-md border shadow-lg shadow-emerald-500/50 border-transparent bg-emerald-500 px-8 py-3 text-center font-medium text-white hover:bg-emerald-600 active:bg-emerald-700">*/}
                {/*    Stream*/}
                {/*</button>*/}
            </div>
        </div>
    );
};

type Props = {};

export default Page;
