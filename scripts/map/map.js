import { CONFIG, TILE_TYPES } from './constants.js';

export class Map {
    constructor(mapData) {
        this.tileData = mapData.tile_data;
        this.widthTiles = mapData.width_tiles;
        this.heightTiles = mapData.height_tiles;
        this.npcs = mapData.npcs || [];  
        
        this.wallColor = '#8B4513';
        this.wallBorderColor = '#5d2f0d';
    }

    get widthPx() {
        return this.widthTiles * CONFIG.TILE_SIZE;
    }
    get heightPx() {
        return this.heightTiles * CONFIG.TILE_SIZE;
    }

    getTileType(tileX, tileY) {
        if (tileX < 0 || tileX >= this.widthTiles || tileY < 0 || tileY >= this.heightTiles) {
            return TILE_TYPES.WALL; 
        }
        return this.tileData[tileY][tileX]; 
    }
    
    /**
     * 指定された矩形領域内に壁があるか判定する (AABB vs Tiles)
     * @param {object} bounds - {x, y, width, height}
     * @returns {boolean}
     */
    isColliding(bounds) {
        const startX = Math.floor(bounds.x / CONFIG.TILE_SIZE);
        const endX = Math.floor((bounds.x + bounds.width - 0.01) / CONFIG.TILE_SIZE);
        const startY = Math.floor(bounds.y / CONFIG.TILE_SIZE);
        const endY = Math.floor((bounds.y + bounds.height - 0.01) / CONFIG.TILE_SIZE);

        for (let y = startY; y <= endY; y++) {
            for (let x = startX; x <= endX; x++) {
                if (this.getTileType(x, y) === TILE_TYPES.WALL) {
                    return true;
                }
            }
        }
        return false;
    }

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

        for (const npc of this.npcs) {
            renderer.drawCircle(
                npc.x * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2,
                npc.y * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2,
                CONFIG.TILE_SIZE / 3, 
                '#FF0000' 
            );
        }
    }
}