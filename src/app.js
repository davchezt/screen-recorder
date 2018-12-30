const {desktopCapturer, ipcRenderer, remote} = require('electron')
const domify = require('domify')

let localStream
let microAudioStream
let recordedChunks = []
let numRecordedChunks = 0
let recorder
let includeMic = false

document.addEventListener('DOMContentLoaded', () => {
  document.querySelector('#record-desktop').addEventListener('click', recordDesktop)
  document.querySelector('#record-camera').addEventListener('click', recordCamera)
  document.querySelector('#record-window').addEventListener('click', recordWindow)
  document.querySelector('#play-video').addEventListener('click', playVideo)
  document.querySelector('#micro-audio').addEventListener('click', microAudioCheck)
  document.querySelector('#record-stop').addEventListener('click', stopRecording)
  document.querySelector('#play-button').addEventListener('click', play)
  document.querySelector('#download-button').addEventListener('click', download)
  document.querySelector('.window-minimize').addEventListener('click', (ev) => {
    remote.getCurrentWindow().minimize()
  })
  document.querySelector('.window-close').addEventListener('click', (ev) => {
    remote.getCurrentWindow().close()
  })
  registerShortcut();
})

const registerShortcut = () => {
  window.addEventListener('keydown', (e) => {
    if (e.key === 'F5') {
      remote.getCurrentWindow().reload()
    }
    if (e.key === 'F12') {
      remote.getCurrentWindow().toggleDevTools()
    }
    if (e.ctrlKey && (e.key === 'd' || e.key === 'D')) {
      recordDesktop();
    }
    if (e.ctrlKey && (e.key === 'w' || e.key === 'W')) {
      recordWindow();
    }
    if (e.ctrlKey && (e.key === 'c' || e.key === 'C')) {
      recordCamera();
    
    }if (e.ctrlKey && (e.key === 'v' || e.key === 'V')) {
      playVideo();
    }
    if (e.ctrlKey && (e.key === 'm' || e.key === 'M')) {
      if (document.getElementById('micro-audio').checked === true) {
        document.getElementById('micro-audio').checked = false;
      }
      else {
        document.getElementById('micro-audio').checked = true;
      }
      microAudioCheck();
    }
  })
}

const playVideo = () => {
  remote.dialog.showOpenDialog({properties: ['openFile']}, (filename) => {
    let video = document.querySelector('video')
    video.muted = false
    video.src = filename
  })
}

const disableButtons = () => {
  document.querySelector('#record-desktop').disabled = true
  document.querySelector('#record-camera').disabled = true
  document.querySelector('#record-window').disabled = true
  document.querySelector('#record-stop').hidden = false
  document.querySelector('#play-button').hidden = true
  document.querySelector('#download-button').hidden = true
}

const enableButtons = () => {
  document.querySelector('#record-desktop').disabled = false
  document.querySelector('#record-camera').disabled = false
  document.querySelector('#record-window').disabled = false
  document.querySelector('#record-stop').hidden = true
  document.querySelector('#play-button').hidden = true
  document.querySelector('#download-button').hidden = true
}

const microAudioCheck = () => {
  var video = document.querySelector('video')
  video.muted = true
  includeMic = !includeMic
  if(includeMic) {
    document.querySelector('#micro-audio-btn').classList.add('active');
  }
  else {
    document.querySelector('#micro-audio-btn').classList.remove('active');
  }
  console.log('Audio =', includeMic)

  if (includeMic) {
    navigator.mediaDevices.getUserMedia({ audio: true, video: false }).then(getMicroAudio).catch(getUserMediaError)
  }
}

const cleanRecord = () => {
  let video = document.querySelector('video');
  video.controls = false;
  recordedChunks = []
  numRecordedChunks = 0
}

ipcRenderer.on('source-id-selected', (event, sourceId) => {
  if (sourceId === null) return
  console.log('#1: ', sourceId)
  cleanRecord()
  onAccessApproved(sourceId)
})

const recordDesktop = () => {
  ipcRenderer.send('show-picker', { types: ['screen'] })
}

const recordWindow = () => {
  ipcRenderer.send('show-picker', { types: ['window'] })
}

const recordCamera = () => {
  navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      mandatory: {
        minWidth: 1280,
        minHeight: 720
      }
    }
  }).then(getMediaStream).catch(getUserMediaError)
}

const recorderOnDataAvailable = (event) => {
  if (event.data && event.data.size > 0) {
    console.log('#6: added chunk');
    recordedChunks.push(event.data)
    numRecordedChunks += event.data.byteLength
  }
}

const stopRecording = () => {
  console.log('#5: Stopping record and starting download')
  enableButtons()
  document.querySelector('#play-button').hidden = false
  document.querySelector('#download-button').hidden = false
  recorder.stop()
  localStream.getVideoTracks()[0].stop()
}

const play = () => {
  let video = document.querySelector('video')
  video.srcObject = null;
  video.controls = true;
  video.muted = false
  let blob = new Blob(recordedChunks, {type: 'video/webm'})
  video.src = URL.createObjectURL(blob)
  video.onloadedmetadata((ev) => video.play())
}

const download = () => {
  let blob = new Blob(recordedChunks, {type: 'video/webm'})
  let url = URL.createObjectURL(blob)
  let a = document.createElement('a')
  document.body.appendChild(a)
  a.style = 'display: none'
  a.href = url
  a.download = 'electron-screen-recorder.webm'
  a.click()
  setTimeout(function () {
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  }, 100)
}

const getMediaStream = (stream) => {
  let video = document.querySelector('video')
  video.muted = true;
  video.srcObject = stream
  video.onloadedmetadata = (e) => video.play()
  localStream = stream
  stream.onended = () => { console.log('Media stream ended.') }

  let videoTracks = localStream.getVideoTracks()

  if (includeMic) {
    console.log('Adding audio track.')
    let audioTracks = microAudioStream.getAudioTracks()
    localStream.addTrack(audioTracks[0])
  }
  try {
    console.log('#3: Start recording the stream.')
    recorder = new MediaRecorder(stream)
  } catch (e) {
    console.assert(false, 'Exception while creating MediaRecorder: ' + e)
    return
  }
  recorder.ondataavailable = recorderOnDataAvailable
  recorder.onstop = () => {
    console.log('#7: recorderOnStop fired')
  }
  recorder.start()
  console.log('#4: Recorder is started.')
  disableButtons()
}

const getMicroAudio = (stream) => {
  console.log('Received audio stream.')
  microAudioStream = stream
  stream.onended = () => { console.log('Micro audio ended.') }
}

const getUserMediaError = (error) => {
  console.log('failed: ', error)
}

const onAccessApproved = (id) => {
  let mandat = includeMic ? false : {
    mandatory: { chromeMediaSource: 'system'}
  }
  if (!id) {
    console.log('Access rejected.')
    return
  }
  console.log('#2: ', id)
  navigator.mediaDevices.getUserMedia({
    audio: mandat,
    video: {
      mandatory: {
        chromeMediaSource: 'desktop',
        chromeMediaSourceId: id,
        maxWidth: window.screen.width,
        maxHeight: window.screen.height
      }
    }
  }).then(getMediaStream)
  .catch(getUserMediaError)
}