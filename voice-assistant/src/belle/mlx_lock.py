"""Global lock for serializing MLX Metal GPU operations.

MLX Metal command buffers are not thread-safe — concurrent operations from
different threads cause 'A command encoder is already encoding to this
command buffer' assertion failures. This lock must be held during any MLX
inference (STT, LLM, TTS).
"""

import threading

mlx_lock = threading.Lock()
