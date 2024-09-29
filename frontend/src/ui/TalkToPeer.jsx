import React, { useState, useEffect, useRef } from "react";
import useSpeechToText from "react-hook-speech-to-text";
import micImage from "../assets/mic.jpg";
import axios from "axios";
import { URL } from "../utils/constant";
import Loader from "../components/Loader";

const TalkToPeer = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [persistentTranscript, setPersistentTranscript] = useState("");

  const transcriptRef = useRef(null);

  const {
    error,
    interimResult,
    isRecording,
    results,
    startSpeechToText,
    stopSpeechToText,
  } = useSpeechToText({
    continuous: true,
    useLegacyResults: false,
    crossBrowser: true,
    speechRecognitionProperties: {
      interimResults: true,
    },
  });

  useEffect(() => {
    if (interimResult) {
      setTranscript(interimResult);
    }
  }, [interimResult]);

  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [persistentTranscript, transcript]);

  useEffect(() => {
    if (results.length > 0 && results[results.length - 1].isFinal) {
      setPersistentTranscript(
        (prev) => prev + " " + results[results.length - 1].transcript
      );
    }
  }, [results]);

  const speakText = (text) => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const chunks = text.match(/.{1,200}/g);
      let chunkIndex = 0;

      const speakNextChunk = () => {
        if (chunkIndex < chunks.length) {
          const utterance = new SpeechSynthesisUtterance(chunks[chunkIndex]);
          const voices = window.speechSynthesis.getVoices();
          utterance.voice = voices.find(
            (voice) => voice.name === "Google US English"
          );

          utterance.onstart = () => {
            setIsSpeaking(true);
          };

          utterance.onend = () => {
            chunkIndex++;
            speakNextChunk();
          };

          utterance.onerror = (event) => {
            console.error("Speech synthesis error:", event.error);
          };

          window.speechSynthesis.speak(utterance);
        } else {
          console.log("All chunks spoken.");
          setIsSpeaking(false);
        }
      };

      speakNextChunk();
    } else {
      console.error("Speech Synthesis is not supported in this browser.");
    }
  };

  const generateResponse = async (text) => {
    setIsProcessing(true);
    const promptToBeSent = `Please respond in plain text without asterisks or any formatting. ${text}`;
    const data = { prompt: promptToBeSent };
    try {
      const res = await axios.post(`${URL}/chat`, data);
      const modelResponse =
        res.data.history
          ?.filter((entry) => entry.role === "model")
          ?.map((entry) => entry.parts?.map((part) => part.text).join(" "))
          ?.join(" ") || "No response from model";
      speakText(modelResponse);
    } catch (error) {
      console.error("Failed to get the response", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleToggleConversation = () => {
    if (isRecording) {
      stopSpeechToText();
      const fullTranscript = persistentTranscript + " " + transcript;
      setPersistentTranscript(fullTranscript.trim());
      setTranscript("");
      generateResponse(fullTranscript.trim());
    } else {
      setPersistentTranscript("");
      setTranscript("");
      startSpeechToText();
    }
  };

  const listening = isRecording || isSpeaking;

  if (error) {
    return <p>Web Speech API is not available in this browser: {error}</p>;
  }

  return (
    <div className="flex flex-col items-center justify-center h-full w-full bg-black text-white">
      <div className="talk-container relative mt-2">
        {/* Effect for speaking or listening */}
        {listening && (
          <>
            <div className="listening"></div>
            <div className="fog"></div>
          </>
        )}
        <img
          src={micImage}
          alt="Microphone"
          className="mic-icon h-[54px] w-[54px] relative z-10"
        />
      </div>

      <div className="relative mb-2 h-10 flex items-center justify-center">
        {isProcessing ? (
          <Loader />
        ) : (
          <div
            onClick={handleToggleConversation}
            className="start-text px-4 py-2 text-white cursor-pointer select-none"
          >
            {isSpeaking
              ? "Comprehending..."
              : isRecording
              ? "Stop Listening"
              : "Start Conversation"}
          </div>
        )}
      </div>

      <div className="w-full max-w-md p-4 bg-gray-600 rounded-lg mb-2">
        <p className="mb-1">Transcript:</p>

        <div
          className="h-[100px] overflow-y-auto no-scrollbar bg-gray-500 p-2 rounded"
          ref={transcriptRef}
        >
          {persistentTranscript}
          {transcript && <span className="text-gray-400"> {transcript}</span>}
        </div>
      </div>
    </div>
  );
};

export default TalkToPeer;
