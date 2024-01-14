import React, {useState, useRef, useContext, useEffect} from "react";
import WaveSurfer from "wavesurfer.js";
import Regions from "wavesurfer.js/dist/plugins/regions.js";
import "./App.css";
const App = () => {
  const wavesurferRef = useRef(null);
  const [region, setRegion] = useState(null);
  const [wavesurfer, setWaveSurfer] = useState(null);
  const [musicFile, setMusicFile] = useState(null);
  useEffect(() => {
    let wavesurfer = wavesurferRef.current;
    if (musicFile) {
      wavesurfer = WaveSurfer.create({
        container: wavesurferRef.current,
        responsive: true,
        height: 100,
        waveColor: "#39A9DB",
        progressColor: "#555555",
        barWidth: 6,
        barRadius: 100,
        barGap: 4,
        cursorColor: "#4a266e",
      });
      wavesurfer.loadBlob(musicFile);
      wavesurferRef.current = wavesurfer;
      setWaveSurfer(wavesurfer);
      wavesurfer.on("ready", () => {
        const regions = Regions.create({wavesurfer: wavesurfer});
        wavesurfer.registerPlugin(regions);
        const region = regions.addRegion({
          start: 5, // Start position in seconds
          end: 10, // End position in seconds
          color: "rgba(129, 137, 195, 0.75)", // Region color
          drag: true, // Enable dragging
          resize: true, // Enable resizing
          loop: true, // Set to true to enable looping within the region
        });
        wavesurfer.on("click", () => {
          setRegion(regions.regions[0]);
          wavesurfer.playPause();
        });
      });
    }
  }, [musicFile]);
  function interleave(buffer) {
    const numberOfChannels = buffer.numberOfChannels;
    const length = buffer.length * numberOfChannels;
    const result = new Float32Array(length);
    let offset = 0;
    for (let channel = 0; channel < numberOfChannels; channel++) {
      const channelData = buffer.getChannelData(channel);
      for (let i = 0; i < buffer.length; i++) {
        result[offset] = channelData[i];
        offset++;
      }
    }

    return result;
  }
  // Function to convert Float32Array audio data to Int16Array
  function bufferToWav(buffer) {
    const interleaved = interleave(buffer);
    const dataView = encodeWAV(interleaved, buffer.sampleRate);
    const audioBlob = new Blob([dataView], {type: "audio/wav"});
    return audioBlob;
  }

  function floatTo16BitPCM(output, offset, input) {
    for (let i = 0; i < input.length; i++, offset += 2) {
      const s = Math.max(-1, Math.min(1, input[i]));
      output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
  }

  function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  function encodeWAV(samples, sampleRate) {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);
    /* RIFF identifier */
    writeString(view, 0, "RIFF");
    /* RIFF chunk length */
    view.setUint32(4, 36 + samples.length * 2, true);
    /* RIFF type */
    writeString(view, 8, "WAVE");
    /* format chunk identifier */
    writeString(view, 12, "fmt ");
    /* format chunk length */
    view.setUint32(16, 16, true);
    /* sample format (raw) */
    view.setUint16(20, 1, true);
    /* channel count */
    view.setUint16(22, 1, true);
    /* sample rate */
    view.setUint32(24, sampleRate, true);
    /* byte rate (sample rate * block align) */
    view.setUint32(28, sampleRate * 4, true);
    /* block align (channel count * bytes per sample) */
    view.setUint16(32, 4, true);
    /* bits per sample */
    view.setUint16(34, 16, true);
    /* data chunk identifier */
    writeString(view, 36, "data");
    /* data chunk length */
    view.setUint32(40, samples.length * 2, true);

    floatTo16BitPCM(view, 44, samples);

    return view;
  }

  const saveAudio = () => {
    const start = region.start;
    const end = region.end;
    const audioBuffer = wavesurfer.decodedData; // Fetch the loaded audio buffer directly from wavesurfer
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const offlineCtx = new OfflineAudioContext(
      audioBuffer.numberOfChannels,
      audioBuffer.length,
      audioBuffer.sampleRate
    );

    const source = offlineCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(offlineCtx.destination);
    source.start();

    offlineCtx.oncomplete = (e) => {
      const clippedAudioBuffer = e.renderedBuffer;
      const startOffset = Math.floor(start * audioBuffer.sampleRate);
      const endOffset = Math.floor(end * audioBuffer.sampleRate);
      const clippedLength = endOffset - startOffset;

      // Create a new audio buffer with the clipped data
      const newAudioBuffer = audioCtx.createBuffer(
        clippedAudioBuffer.numberOfChannels,
        clippedLength,
        clippedAudioBuffer.sampleRate
      );

      // Copy the clipped data from the source buffer to the destination buffer
      for (let channel = 0; channel < clippedAudioBuffer.numberOfChannels; channel++) {
        newAudioBuffer.copyToChannel(
          clippedAudioBuffer.getChannelData(channel).subarray(startOffset, endOffset),
          channel
        );
      }

      // Convert the new audio buffer to a WAV file
      const audioBlob = bufferToWav(newAudioBuffer);
      // Create a download link
      const downloadLink = document.createElement("a");
      downloadLink.href = URL.createObjectURL(audioBlob);
      downloadLink.download = "clipped_audio.wav";
      document.body.appendChild(downloadLink);
      // Trigger the download
      downloadLink.click();

      // Clean up the download link
      document.body.removeChild(downloadLink);
    };

    offlineCtx.startRendering();
  };

  return (
    <>
      <div id="music-main">
        <div id="head69">Audio Trimming with WaveSurfer in React </div>
        <div id="ext">
          Versions required for this to work
          <br />
          Node (14.21.3).
          <br />
          WaveSurfer (7.5.5)
        </div>
        <div id="t-color" className="tcolor">
          <div id="music-wrapper">
            <input
              type="file"
              accept=".mp3,audio/*"
              id="file"
              onChange={(e) => {
                setMusicFile(e.target.files[0]);
              }}
            />
          </div>
        </div>
        <div id="bottom-video-section" className="bottom-video-section-new">
          <div id="waveform" ref={wavesurferRef}></div>
          <div id="bata" onClick={() => saveAudio()}>
            Save clip
          </div>
        </div>
      </div>
    </>
  );
};

export default App;
