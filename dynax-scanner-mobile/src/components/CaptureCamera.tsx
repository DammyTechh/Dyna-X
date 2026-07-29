import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Modal } from 'react-native';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/theme';
import { Button } from '@/components/ui';

// Full-screen recorder. Produces a video file URI (MP4/MOV depending on device);
// the backend normalizes anything non-MP4 for reconstruction.
export function CaptureCamera({
  visible,
  maxSeconds,
  onCaptured,
  onClose,
}: {
  visible: boolean;
  maxSeconds: number;
  onCaptured: (uri: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<CameraView | null>(null);
  const [camPerm, requestCam] = useCameraPermissions();
  const [micPerm, requestMic] = useMicrophonePermissions();
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (visible) {
      if (!camPerm?.granted) requestCam();
      if (!micPerm?.granted) requestMic();
    }
  }, [visible]);

  useEffect(() => {
    if (!recording) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [recording]);

  async function start() {
    if (!ref.current) return;
    setSeconds(0);
    setRecording(true);
    try {
      const video = await ref.current.recordAsync({ maxDuration: maxSeconds });
      if (video?.uri) onCaptured(video.uri);
    } catch {
      /* cancelled */
    } finally {
      setRecording(false);
    }
  }

  function stop() {
    ref.current?.stopRecording();
    setRecording(false);
  }

  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        {camPerm?.granted ? (
          <CameraView ref={ref} style={StyleSheet.absoluteFill} facing="back" mode="video" />
        ) : (
          <View style={styles.permission}>
            <Ionicons name="camera-outline" size={40} color={theme.color.textMuted} />
            <Text style={styles.permText}>Camera access is needed to record a scan.</Text>
            <Button label="Grant access" variant="glass" onPress={requestCam} />
          </View>
        )}

        <Pressable onPress={onClose} style={styles.close} hitSlop={12}>
          <Ionicons name="close" size={22} color={theme.color.white} />
        </Pressable>

        {recording && (
          <View style={styles.timer}>
            <View style={styles.dot} />
            <Text style={styles.timerText}>{mm}:{ss}</Text>
          </View>
        )}

        <View style={styles.controls}>
          <Text style={styles.hint}>Slowly orbit the anatomy — keep it centred and evenly lit.</Text>
          {!recording ? (
            <Pressable onPress={start} disabled={!camPerm?.granted} style={[styles.recBtn, !camPerm?.granted && { opacity: 0.4 }]}>
              <View style={styles.recInner} />
            </Pressable>
          ) : (
            <Pressable onPress={stop} style={styles.stopBtn}>
              <View style={styles.stopInner} />
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  permission: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: theme.space(4), padding: theme.space(6) },
  permText: { color: theme.color.textMuted, textAlign: 'center', fontSize: theme.font.body },
  close: { position: 'absolute', top: 56, right: 20, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 999, padding: 8 },
  timer: {
    position: 'absolute', top: 58, left: 20, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
  },
  dot: { width: 9, height: 9, borderRadius: 999, backgroundColor: theme.color.red },
  timerText: { color: theme.color.white, fontWeight: '700' },
  controls: { position: 'absolute', bottom: 60, left: 0, right: 0, alignItems: 'center', gap: theme.space(5) },
  hint: { color: 'rgba(255,255,255,0.85)', fontSize: theme.font.small, textAlign: 'center', maxWidth: 300 },
  recBtn: { width: 76, height: 76, borderRadius: 999, borderWidth: 4, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  recInner: { width: 58, height: 58, borderRadius: 999, backgroundColor: theme.color.red },
  stopBtn: { width: 76, height: 76, borderRadius: 999, borderWidth: 4, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  stopInner: { width: 30, height: 30, borderRadius: 6, backgroundColor: '#fff' },
});
