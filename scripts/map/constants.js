// constants.js

// ゲーム全体の設定
export const CONFIG = {
    TILE_SIZE: 32,
    PLAYER_SIZE: 24,
    VIEWPORT_WIDTH_TILES: 32, // ビューポートの横幅（タイル数）
    VIEWPORT_HEIGHT_TILES: 18, // ビューポートの縦幅（タイル数）
    get VIEWPORT_WIDTH() { return this.VIEWPORT_WIDTH_TILES * this.TILE_SIZE },
    get VIEWPORT_HEIGHT() { return this.VIEWPORT_HEIGHT_TILES * this.TILE_SIZE },
    
    PLAYER_SPEED_PPS: 256, // 1秒あたりのピクセル移動量
};

// タイルの種類
export const TILE_TYPES = {
    GRASS: 0,
    WALL: 1,
    BATTLE_TRIGGER: 2, // 戦闘発生タイル
};

// プレイヤーの状態（ステートマシン用）
export const PLAYER_STATES = {
    IDLE: 'idle',
    WALKING: 'walking',
};

// キーマッピング
export const KEY_MAP = {
    ArrowUp: 'up',
    ArrowDown: 'down',
    ArrowLeft: 'left',
    ArrowRight: 'right',
    z: 'z', // Zキーを追加
    x: 'x', // Xキーを追加
};

// マップ固有のイベント
export const MAP_EVENTS = {
    BATTLE_TRIGGERED: 'MAP_BATTLE_TRIGGERED', // 戦闘発生タイルに到達した
};
