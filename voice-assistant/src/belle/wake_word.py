"""Wake word detection module using Porcupine (optional)."""

import logging
from collections.abc import Callable

import numpy as np

logger = logging.getLogger(__name__)

# Lazy-loaded Porcupine instance
_porcupine = None
_is_available = None


def _check_availability() -> bool:
    """Check if Porcupine is available."""
    global _is_available

    if _is_available is not None:
        return _is_available

    try:
        import pvporcupine

        _is_available = True
        logger.info("Porcupine wake word detection is available")
    except ImportError:
        _is_available = False
        logger.warning(
            "Porcupine not installed. Install with: uv sync --extra wake"
        )

    return _is_available


def is_available() -> bool:
    """Check if wake word detection is available."""
    return _check_availability()


def create_detector(
    access_key: str,
    keywords: list[str] | None = None,
    keyword_paths: list[str] | None = None,
    sensitivities: list[float] | None = None,
):
    """
    Create a Porcupine wake word detector.

    Args:
        access_key: Picovoice access key (get free at console.picovoice.ai)
        keywords: Built-in keyword names (e.g., ['porcupine', 'bumblebee'])
        keyword_paths: Paths to custom .ppn keyword files
        sensitivities: Detection sensitivities (0-1) for each keyword

    Returns:
        Porcupine detector instance or None if unavailable
    """
    if not _check_availability():
        return None

    import pvporcupine

    try:
        detector = pvporcupine.create(
            access_key=access_key,
            keywords=keywords,
            keyword_paths=keyword_paths,
            sensitivities=sensitivities,
        )
        logger.info(f"Created wake word detector with keywords: {keywords or keyword_paths}")
        return detector
    except Exception as e:
        logger.error(f"Failed to create wake word detector: {e}")
        return None


def process_audio_frame(detector, audio_frame: np.ndarray) -> int:
    """
    Process an audio frame and check for wake word.

    Args:
        detector: Porcupine detector instance
        audio_frame: Audio frame as int16 numpy array (512 samples at 16kHz)

    Returns:
        Keyword index (>= 0) if detected, -1 otherwise
    """
    if detector is None:
        return -1

    # Ensure correct format
    if audio_frame.dtype != np.int16:
        audio_frame = (audio_frame * 32767).astype(np.int16)

    return detector.process(audio_frame)


class WakeWordListener:
    """
    Continuous wake word listener that runs in a background thread.

    Usage:
        listener = WakeWordListener(
            access_key="your-key",
            keywords=["porcupine"],  # or custom keyword paths
            on_detected=lambda kw: print(f"Detected: {kw}")
        )
        listener.start()
        # ... later ...
        listener.stop()
    """

    def __init__(
        self,
        access_key: str,
        keywords: list[str] | None = None,
        keyword_paths: list[str] | None = None,
        sensitivities: list[float] | None = None,
        on_detected: Callable[[str], None] | None = None,
    ):
        self.access_key = access_key
        self.keywords = keywords or []
        self.keyword_paths = keyword_paths or []
        self.sensitivities = sensitivities
        self.on_detected = on_detected

        self._detector = None
        self._stream = None
        self._running = False
        self._thread = None

    def start(self):
        """Start listening for wake words in background thread."""
        if self._running:
            logger.warning("Wake word listener already running")
            return

        if not _check_availability():
            logger.error("Cannot start wake word listener - Porcupine not available")
            return

        import pvporcupine

        try:
            self._detector = pvporcupine.create(
                access_key=self.access_key,
                keywords=self.keywords if self.keywords else None,
                keyword_paths=self.keyword_paths if self.keyword_paths else None,
                sensitivities=self.sensitivities,
            )
        except Exception as e:
            logger.error(f"Failed to create detector: {e}")
            return

        self._running = True

        import threading

        self._thread = threading.Thread(target=self._listen_loop, daemon=True)
        self._thread.start()
        logger.info("Wake word listener started")

    def stop(self):
        """Stop the wake word listener."""
        self._running = False

        if self._stream:
            self._stream.stop()
            self._stream.close()
            self._stream = None

        if self._detector:
            self._detector.delete()
            self._detector = None

        if self._thread:
            self._thread.join(timeout=2.0)
            self._thread = None

        logger.info("Wake word listener stopped")

    def _listen_loop(self):
        """Main listening loop (runs in background thread)."""
        import sounddevice as sd

        frame_length = self._detector.frame_length
        sample_rate = self._detector.sample_rate

        def audio_callback(indata, frames, time, status):
            if status:
                logger.warning(f"Audio status: {status}")

            if not self._running:
                return

            # Convert to int16
            audio = (indata[:, 0] * 32767).astype(np.int16)

            # Process frame
            result = self._detector.process(audio)

            if result >= 0:
                # Wake word detected
                keyword = (
                    self.keywords[result]
                    if self.keywords
                    else f"keyword_{result}"
                )
                logger.info(f"Wake word detected: {keyword}")

                if self.on_detected:
                    self.on_detected(keyword)

        try:
            with sd.InputStream(
                samplerate=sample_rate,
                blocksize=frame_length,
                channels=1,
                dtype=np.float32,
                callback=audio_callback,
            ):
                logger.info(f"Listening for wake words at {sample_rate}Hz...")
                while self._running:
                    sd.sleep(100)
        except Exception as e:
            logger.error(f"Error in wake word listener: {e}")
            self._running = False

    @property
    def is_running(self) -> bool:
        """Check if the listener is running."""
        return self._running
