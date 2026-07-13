# 🎬 Legendas Pro

Sistema profissional de transcrição, edição, tradução, exportação e renderização de legendas para vídeo. Uma aplicação web local com backend em Node.js/Express, frontend em HTML/CSS/JavaScript puro e motores Python integrados para transcrição offline com aceleração CUDA.

## 🚀 Visão Geral

O **Legendas Pro** é uma suíte completa de legendagem projetada para operar 100% offline, oferecendo:

- ✅ Upload e gestão de arquivos de vídeo/áudio
- ✅ Transcrição automática offline com Whisper (faster-whisper, stable-ts, whisperx)
- ✅ Editor de legendas sincronizado com playback de vídeo
- ✅ Timeline visual dos segmentos
- ✅ Exportação para múltiplos formatos (SRT, VTT, TXT, JSON, ASS)
- ✅ Tradução de legendas (em desenvolvimento)
- ✅ Renderização de legenda queimada no vídeo (em desenvolvimento)
- ✅ Processamento em lote (em desenvolvimento)
- ✅ Histórico de vídeos processados
- ✅ Configurações avançadas de engine, modelo e estilo
- ✅ Interface moderna em dark mode
- ✅ Comunicação em tempo real via WebSocket

## 🏗️ Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (Navegador)                     │
│  HTML/CSS/JS Puro | Dashboard | Editor | Histórico | Config │
└─────────────────────────────────────────────────────────────┘
                            ↕ HTTP/WebSocket
┌─────────────────────────────────────────────────────────────┐
│                   Backend Node.js/Express                    │
│  API REST | Socket.IO | Multer | FFmpeg (futuro)            │
│  Controllers | Routes | Models | Sockets                     │
└─────────────────────────────────────────────────────────────┘
                            ↕ Subprocess (JSON/Stdout)
┌─────────────────────────────────────────────────────────────┐
│              Camada Python (Motores de Transcrição)          │
│  faster-whisper | stable-ts | whisperx | CUDA (opcional)    │
└─────────────────────────────────────────────────────────────┘
                            ↕ SQLite
┌─────────────────────────────────────────────────────────────┐
│  Banco de Dados (better-sqlite3)                             │
│  videos | transcricoes | segmentos | jobs | configuracoes   │
└─────────────────────────────────────────────────────────────┘
```

## 📁 Estrutura do Projeto

```
legendas-pro/
├── backend/
│   ├── src/
│   │   ├── config/          # Configurações da aplicação
│   │   ├── controllers/     # Controladores da API
│   │   ├── database/        # Inicialização do banco de dados
│   │   ├── models/          # Modelos de dados
│   │   ├── routes/          # Rotas da API
│   │   ├── sockets/         # Handlers WebSocket
│   │   ├── services/        # Serviços (FFmpeg, etc.)
│   │   ├── utils/           # Utilitários
│   │   └── server.js        # Ponto de entrada
│   ├── uploads/             # Arquivos enviados
│   └── outputs/             # Arquivos processados
├── frontend/
│   ├── css/
│   │   └── styles.css       # Estilos globais
│   ├── js/
│   │   └── app.js           # Lógica do frontend
│   ├── assets/              # Imagens, ícones
│   └── index.html           # Página principal
├── python/
│   └── engines/
│       └── transcribe.py    # Scripts de transcrição
├── database/                # Banco de dados SQLite
├── package.json
├── .env                     # Variáveis de ambiente
└── README.md
```

## 🛠️ Instalação

### Pré-requisitos

- **Node.js** 18+ instalado
- **Python** 3.8+ instalado
- **FFmpeg** acessível via PATH (para renderização futura)
- **CUDA** (opcional, para aceleração GPU)

### Passo a Passo

1. **Clone o repositório** (ou acesse a pasta do projeto):
   ```bash
   cd /workspace
   ```

2. **Instale as dependências do Node.js**:
   ```bash
   npm install
   ```

3. **Instale as dependências Python** (opcional, para transcrição):
   ```bash
   pip install faster-whisper stable-ts whisperx
   ```

4. **Configure as variáveis de ambiente**:
   ```bash
   cp .env.example .env
   # Edite .env conforme necessário
   ```

5. **Inicialize o banco de dados**:
   ```bash
   npm run init:db
   # ou
   node backend/src/database/init.js
   ```

6. **Inicie o servidor**:
   ```bash
   npm start
   # ou para development com auto-reload:
   npm run dev
   ```

7. **Acesse a aplicação**:
   ```
   http://localhost:3000
   ```

## 📖 Uso

### 1. Upload de Vídeo

- Arraste e solte um arquivo de vídeo/áudio na área de upload
- Ou clique para selecionar um arquivo
- Formatos suportados: MP4, MKV, AVI, MOV, WEBM, MP3, WAV

### 2. Transcrição

- Após o upload, clique em "📝 Transcrever" no card do vídeo
- Configure as opções:
  - **Engine**: faster-whisper (recomendado), stable-ts ou whisperx
  - **Modelo**: tiny, base, small, medium, large (quanto maior, mais preciso e lento)
  - **Dispositivo**: GPU (CUDA) ou CPU
  - **Idioma**: Português, Inglês, Espanhol, etc. ou Automático
- Clique em "Iniciar Transcrição"

### 3. Edição

- Clique em "✏️ Editar" para abrir o editor
- O player de vídeo sincroniza com as legendas
- Edite o texto, tempo de início e fim de cada segmento
- Use a timeline para visualizar a distribuição das legendas
- Exporte em diversos formatos (SRT, VTT, TXT, JSON, ASS)

### 4. Histórico

- Acesse a página "Histórico" para ver todas as transcrições
- Reabra edições anteriores
- Baixe legendas em SRT diretamente

### 5. Configurações

- Personalize o comportamento do sistema
- Alterne entre tema dark/light (futuro)
- Configure padrões de engine e modelo

## ⚙️ Configuração

### Variáveis de Ambiente (.env)

| Variável | Descrição | Padrão |
|----------|-----------|--------|
| `PORT` | Porta do servidor HTTP | `3000` |
| `NODE_ENV` | Ambiente (development/production) | `development` |
| `DATABASE_PATH` | Caminho do banco de dados SQLite | `./database/legendas_pro.db` |
| `UPLOAD_DIR` | Diretório de uploads | `./backend/uploads` |
| `OUTPUT_DIR` | Diretório de outputs | `./backend/outputs` |
| `PYTHON_PATH` | Caminho do interpretador Python | `python3` |
| `MAX_FILE_SIZE` | Tamanho máximo de upload (bytes) | `2147483648` (2GB) |
| `DEFAULT_ENGINE` | Engine padrão | `faster-whisper` |
| `DEFAULT_MODEL` | Modelo padrão | `base` |
| `DEFAULT_DEVICE` | Dispositivo padrão | `cuda` |

## 🔌 API REST

### Vídeos

- `POST /api/videos/upload` - Upload de vídeo
- `GET /api/videos` - Listar vídeos
- `GET /api/videos/:id` - Buscar vídeo por ID
- `DELETE /api/videos/:id` - Deletar vídeo
- `GET /api/videos/:id/transcricao` - Buscar transcrição do vídeo

### Transcrições

- `POST /api/transcricoes/:videoId/iniciar` - Iniciar transcrição
- `GET /api/transcricoes` - Listar transcrições
- `GET /api/transcricoes/:id` - Buscar transcrição com segmentos
- `PUT /api/transcricoes/:id/status` - Atualizar status
- `DELETE /api/transcricoes/:id` - Deletar transcrição

### Exportação

- `GET /api/export/:transcricaoId/:formato` - Exportar legenda
  - Formatos: `srt`, `vtt`, `txt`, `json`, `ass`

### Configurações

- `GET /api/config` - Listar configurações
- `GET /api/config/:key` - Buscar configuração
- `PUT /api/config/:key` - Atualizar configuração
- `POST /api/config` - Criar configuração

### WebSocket (Socket.IO)

Eventos disponíveis:

- `join-room` - Entrar em uma sala
- `leave-room` - Sair de uma sala
- `request-job-status` - Solicitar status de job
- `request-progress` - Solicitar progresso
- `progress-update` - Atualização de progresso (server → client)

## 🧪 Desenvolvimento

### Scripts Disponíveis

```bash
npm start        # Inicia o servidor em produção
npm run dev      # Inicia com nodemon (auto-reload)
npm run init:db  # Inicializa o banco de dados
```

### Adicionando Novas Engines

1. Crie a função de transcrição em `/python/engines/transcribe.py`
2. Adicione a lógica de seleção no controller
3. Atualize a lista de engines disponíveis no frontend

### Adicionando Novos Formatos de Exportação

1. Crie a função de formatação em `/backend/src/routes/export.routes.js`
2. Adicione o formato à lista de suportados
3. Defina o MIME type e extensão apropriados

## 📝 Roadmap

### v1.0.0 (Atual)
- ✅ Estrutura base do projeto
- ✅ Upload de vídeos
- ✅ Transcrição com múltiplas engines
- ✅ Editor de legendas básico
- ✅ Exportação em múltiplos formatos
- ✅ WebSocket para atualizações em tempo real
- ✅ Banco de dados SQLite

### Próximas Versões
- [ ] Tradução automática de legendas
- [ ] Renderização hardsub (legenda queimada)
- [ ] Processamento em lote
- [ ] Fila de jobs com Bull
- [ ] Undo/Redo no editor
- [ ] Split e merge de segmentos
- [ ] Busca e substituição
- [ ] Atalhos de teclado
- [ ] Detecção automática de falantes
- [ ] Estilização avançada de legendas (ASS)

## 🤝 Contribuindo

Contribuições são bem-vindas! Siga os princípios do projeto:

1. Código limpo e documentado
2. Módulos com responsabilidade única
3. Sem dependência de internet
4. Sem frameworks CSS ou JS
5. Tratamento adequado de erros

## 📄 Licença

MIT License - veja o arquivo LICENSE para detalhes.

## 🆘 Suporte

Para issues, bugs ou sugestões, abra uma issue no repositório.

---

**Legendas Pro** © 2024 - Construído com ❤️ para profissionais de legendagem
