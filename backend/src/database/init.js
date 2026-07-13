const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Garantir que o diretório do banco de dados existe
const dbDir = path.join(__dirname, '..', 'database');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = process.env.DATABASE_PATH || path.join(dbDir, 'legendas_pro.db');
const db = new Database(dbPath);

// Habilitar foreign keys
db.pragma('foreign_keys = ON');

// Criar tabelas
db.exec(`
  -- Tabela de vídeos
  CREATE TABLE IF NOT EXISTS videos (
    id TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    filepath TEXT NOT NULL,
    filesize INTEGER NOT NULL,
    mimetype TEXT NOT NULL,
    duration REAL,
    width INTEGER,
    height INTEGER,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Tabela de transcrições
  CREATE TABLE IF NOT EXISTS transcricoes (
    id TEXT PRIMARY KEY,
    video_id TEXT NOT NULL,
    engine TEXT NOT NULL,
    model TEXT NOT NULL,
    device TEXT NOT NULL,
    language TEXT DEFAULT 'pt',
    status TEXT DEFAULT 'pending',
    progress REAL DEFAULT 0,
    error_message TEXT,
    started_at DATETIME,
    completed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
  );

  -- Tabela de segmentos de legenda
  CREATE TABLE IF NOT EXISTS segmentos (
    id TEXT PRIMARY KEY,
    transcricao_id TEXT NOT NULL,
    start_time REAL NOT NULL,
    end_time REAL NOT NULL,
    text TEXT NOT NULL,
    speaker TEXT,
    confidence REAL,
    position INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (transcricao_id) REFERENCES transcricoes(id) ON DELETE CASCADE
  );

  -- Tabela de jobs da fila
  CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    video_id TEXT NOT NULL,
    status TEXT DEFAULT 'waiting',
    priority INTEGER DEFAULT 0,
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    error_message TEXT,
    data TEXT,
    result TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    started_at DATETIME,
    completed_at DATETIME,
    FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
  );

  -- Tabela de configurações
  CREATE TABLE IF NOT EXISTS configuracoes (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Tabela de histórico de processamentos
  CREATE TABLE IF NOT EXISTS historico (
    id TEXT PRIMARY KEY,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    details TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Índices para performance
  CREATE INDEX IF NOT EXISTS idx_videos_status ON videos(status);
  CREATE INDEX IF NOT EXISTS idx_transcricoes_video_id ON transcricoes(video_id);
  CREATE INDEX IF NOT EXISTS idx_transcricoes_status ON transcricoes(status);
  CREATE INDEX IF NOT EXISTS idx_segmentos_transcricao_id ON segmentos(transcricao_id);
  CREATE INDEX IF NOT EXISTS idx_historico_created_at ON historico(created_at);
`);

// Inserir configurações padrão
const defaultConfigs = [
  { key: 'default_engine', value: 'faster-whisper', description: 'Engine de transcrição padrão' },
  { key: 'default_model', value: 'base', description: 'Modelo Whisper padrão' },
  { key: 'default_device', value: 'cuda', description: 'Dispositivo padrão (cuda ou cpu)' },
  { key: 'default_language', value: 'pt', description: 'Idioma padrão para transcrição' },
  { key: 'auto_save', value: 'true', description: 'Salvar automaticamente edições' },
  { key: 'autosave_interval', value: '30', description: 'Intervalo de auto-save em segundos' },
  { key: 'theme', value: 'dark', description: 'Tema da interface (dark ou light)' },
  { key: 'max_concurrent_jobs', value: '2', description: 'Máximo de jobs simultâneos' }
];

const insertConfig = db.prepare(`
  INSERT OR REPLACE INTO configuracoes (key, value, description, updated_at)
  VALUES (?, ?, ?, CURRENT_TIMESTAMP)
`);

for (const config of defaultConfigs) {
  insertConfig.run(config.key, config.value, config.description);
}

console.log('✅ Banco de dados inicializado com sucesso!');
console.log(`📁 Localização: ${dbPath}`);

module.exports = db;
