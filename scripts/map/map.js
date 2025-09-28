// map.js
import { CONFIG, TILE_TYPES } from './constants.js';

export class Map {
    // ★ コンストラクタでマップデータを受け取る
    constructor(mapData) {
        this.tileData = mapData.tile_data;
        this.widthTiles = mapData.width_tiles;
        this.heightTiles = mapData.height_tiles;
        this.npcs = mapData.npcs || [];  // NPC情報を追加
        
        this.wallColor = '#8B4513';
        this.wallBorderColor = '#5d2f0d';
    }

    // ★ ピクセル単位の幅と高さを計算するゲッターを追加
    get widthPx() {
        return this.widthTiles * CONFIG.TILE_SIZE;
    }
    get heightPx() {
        return this.heightTiles * CONFIG.TILE_SIZE;
    }

    getTileType(tileX, tileY) {
        if (tileX < 0 || tileX >= this.widthTiles || tileY < 0 || tileY >= this.heightTiles) {
            return TILE_TYPES.WALL; // マップ範囲外は壁扱い
        }
        return this.tileData[tileY][tileX]; // ★ プロパティ名を変更
    }
    
    /**
     * 指定された矩形が壁と衝突するか判定する
     * @param {object} bounds - {x, y, width, height} の当たり判定矩形
     * @returns {boolean} - 衝突する場合はtrue
     */
    isColliding(bounds) {
        const { x, y, width, height } = bounds;
        const leftTile = Math.floor(x / CONFIG.TILE_SIZE);
        const rightTile = Math.floor((x + width - 1) / CONFIG.TILE_SIZE);
        const topTile = Math.floor(y / CONFIG.TILE_SIZE);
        const bottomTile = Math.floor((y + height - 1) / CONFIG.TILE_SIZE);

        for (let ty = topTile; ty <= bottomTile; ty++) {
            for (let tx = leftTile; tx <= rightTile; tx++) {
                if (this.getTileType(tx, ty) === TILE_TYPES.WALL) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * マップを描画する (ビューポートカリング対応)
     * @param {Renderer} renderer 
     * @param {Camera} camera 
     */
    draw(renderer, camera) {
        const startCol = Math.floor(camera.x / CONFIG.TILE_SIZE);
        const endCol = Math.min(startCol + CONFIG.VIEWPORT_WIDTH_TILES + 1, this.widthTiles);
        const startRow = Math.floor(camera.y / CONFIG.TILE_SIZE);
        const endRow = Math.min(startRow + CONFIG.VIEWPORT_HEIGHT_TILES + 1, this.heightTiles);
        
        for (let y = startRow; y < endRow; y++) {
            for (let x = startCol; x < endCol; x++) {
                if (this.tileData[y][x] === TILE_TYPES.WALL) {
                    renderer.drawRect(
                        x * CONFIG.TILE_SIZE,
                        y * CONFIG.TILE_SIZE,
                        CONFIG.TILE_SIZE,
                        CONFIG.TILE_SIZE,
                        this.wallColor,
                        this.wallBorderColor
                    );
                }
            }
        }

        // NPCアイコンを描画
        for (const npc of this.npcs) {
            renderer.drawCircle(
                npc.x * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2,
                npc.y * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2,
                CONFIG.TILE_SIZE / 3, // 半径はタイルサイズの1/3
                '#FF0000' // 赤色でNPCを表現
            );
        }
    }
}