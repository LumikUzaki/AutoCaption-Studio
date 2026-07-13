# Legendas Pro - Python Backend

Backend Python para processamento de IA (transcrição e tradução) usando Faster-Whisper, Stable-TS, WhisperX e motores de tradução offline.

## 📋 Requisitos

- **Python:** 3.8+ (recomendado 3.10 ou 3.11)
- **CUDA:** 11.8+ (opcional, mas recomendado para GPU)
- **FFmpeg:** 5.x+ (instalado no sistema)

## 🚀 Instalação

### 1. Instalar dependências do sistema

#### Ubuntu/Debian
```bash
sudo apt update
sudo apt install -y python3-pip python3-dev ffmpeg nvidia-cuda-toolkit
```

#### Windows
```powershell
# Instalar Python 3.10+ do site oficial
# Instalar FFmpeg via Chocolatey
choco install ffmpeg
# Instalar CUDA Toolkit da NVIDIA
```

#### macOS
```bash
brew install python ffmpeg
```

### 2. Instalar dependências Python

```bash
cd python
pip install -r requirements.txt
```

### 3. Verificar instalação

```bash
python run.py
```

## 📁 Estrutura

```
python/
├── main.py                 # Entry point do bridge
├── run.py                  # Script de inicialização
├── requirements.txt        # Dependências
├── logs/                   # Logs do bridge
├── models/                 # Modelos de IA baixados
└── src/
    ├── __init__.py
    ├── bridge/
    │   ├── __init__.py
    │   └── server.py       # Servidor JSON bridge
    ├── engines/
    │   ├── __init__.py
    │   └── transcription_engine.py  # Engines de transcrição
    ├── translators/
    │   ├── __init__.py
    │   └── translation_engine.py    # Motores de tradução
    ├── managers/
    │   ├── __init__.py
    │   ├── gpu_manager.py          # Gerenciamento de GPU
    │   └── model_manager.py        # Gerenciamento de modelos
    └── utils/
        ├── __init__.py
        └── audio_utils.py          # Utilitários de áudio
```

## 🔧 Uso

### Executar como processo standalone

O Python backend é executado automaticamente pelo Node.js via `child_process`. Não é necessário executar manualmente.

### Comandos suportados via Bridge JSON

**Transcrição:**
```json
{
  "id": "uuid-123",
  "command": "transcribe",
  "params": {
    "audioPath": "/path/to/audio.wav",
    "engine": "faster-whisper",
    "model": "large-v3",
    "language": "pt",
    "options": {
      "beamSize": 5,
      "wordTimestamps": true
    }
  }
}
```

**Tradução:**
```json
{
  "id": "uuid-456",
  "command": "translate",
  "params": {
    "text": "Olá mundo",
    "sourceLang": "pt",
    "targetLang": "en",
    "engine": "argos"
  }
}
```

**Status do sistema:**
```json
{
  "id": "uuid-789",
  "command": "getStatus"
}
```

## 🎯 Engines Suportadas

### Transcrição
- **Faster-Whisper** (padrão) - 4x mais rápido, menos VRAM
- **Stable-TS** - Timestamps mais precisos
- **WhisperX** - Alinhamento de palavras e diarização

### Tradução
- **Argos Translate** - Offline, rápido, 200+ idiomas
- **MarianMT** - Qualidade superior via HuggingFace
- **NLLB** (Meta) - Idiomas de baixa resource

## 📊 Modelos de Transcrição

| Modelo | Tamanho | VRAM Mínima | Velocidade | Qualidade |
|--------|---------|-------------|------------|-----------|
| tiny   | 150 MB  | 1 GB        | Muito rápida | Básica |
| base   | 150 MB  | 1 GB        | Rápida     | Boa |
| small  | 500 MB  | 2 GB        | Média      | Muito boa |
| medium | 1.5 GB  | 4 GB        | Lenta      | Excelente |
| large-v3 | 3.1 GB | 6 GB      | Muito lenta | State-of-the-art |

## 🔍 Troubleshooting

### CUDA não disponível
```bash
# Verificar se CUDA está instalado
nvidia-smi

# Verificar se PyTorch vê a GPU
python -c "import torch; print(torch.cuda.is_available())"
```

### Erro de memória (OOM)
- Use modelo menor (tiny, base)
- Feche outras aplicações usando GPU
- Reduza batch size

### FFmpeg não encontrado
```bash
# Verificar instalação
ffmpeg -version

# Instalar se necessário
sudo apt install ffmpeg  # Linux
brew install ffmpeg      # macOS
choco install ffmpeg     # Windows
```

## 📝 Logs

Logs são salvos em:
- `/workspace/python/logs/bridge.log`

Para visualizar em tempo real:
```bash
tail -f /workspace/python/logs/bridge.log
```

## 🧪 Testes

```bash
# Testar conexão com o bridge
echo '{"id": "test", "command": "ping"}' | python run.py
```

## 📄 Licença

MIT License
