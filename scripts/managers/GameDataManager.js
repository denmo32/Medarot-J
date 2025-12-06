/**
 * @file GameDataManager.js
 * @description ゲーム全体の永続的な状態（セーブデータ）を一元管理するシングルトンクラス。
 */

import { MEDAROT_SETS } from '../data/medarotSets.js';
import { PARTS_DATA } from '../data/parts.js';
import { MEDALS_DATA } from '../data/medals.js';
import { CONFIG as MAP_CONFIG } from '../map/constants.js';
import { buildPartData } from '../data/partDataUtils.js';

// デフォルトのプレイヤー初期位置
const initialPlayerPosition = {
    x: 1 * MAP_CONFIG.TILE_SIZE + (MAP_CONFIG.TILE_SIZE - MAP_CONFIG.PLAYER_SIZE) / 2,
    y: 1 * MAP_CONFIG.TILE_SIZE + (MAP_CONFIG.TILE_SIZE - MAP_CONFIG.PLAYER_SIZE) / 2,
    mapName: 'map.json',
    direction: 'down',
};

const defaultPlayerMedarots = [
    {
        id: 'player_medarot_1',
        name: 'サイカチス',
        medalId: 'kabuto',
        set: MEDAROT_SETS[0]
    },
    {
        id: 'player_medarot_2',
        name: 'ロクショウ',
        medalId: 'kuwagata',
        set: MEDAROT_SETS[1]
    },
    {
        id: 'player_medarot_3',
        name: 'ドークス',
        medalId: 'bear',
        set: MEDAROT_SETS[3]
    }
];

let instance = null;

export class GameDataManager {
    constructor() {
        if (instance) {
            return instance;
        }
        this.gameData = null;
        this.loadGame(); 

        instance = this;
    }

    resetToDefault() {
        const medarots = JSON.parse(JSON.stringify(defaultPlayerMedarots));

        const inventory = {};
        for (const partType in PARTS_DATA) {
            inventory[partType] = {};
            for (const partId in PARTS_DATA[partType]) {
                inventory[partType][partId] = { count: 1 };
            }
        }

        const medalsInventory = {};
        for (const medalId in MEDALS_DATA) {
            medalsInventory[medalId] = { count: 1 };
        }

        this.gameData = {
            playerPosition: { ...initialPlayerPosition },
            playerMedarots: medarots,
            playerPartsInventory: inventory,
            playerMedalsInventory: medalsInventory,
        };
        console.log('Game data has been reset to default.');
    }

    loadGame() {
        try {
            const savedData = localStorage.getItem('medarotJSaveData');
            if (savedData) {
                this.gameData = JSON.parse(savedData);
                console.log('Game data loaded from localStorage.', this.gameData);

                if (this._migrateSaveData()) {
                    this.saveGame();
                }

            } else {
                console.log('No save data found. Initializing with default data.');
                this.resetToDefault();
            }
        } catch (error) {
            console.error('Failed to load game data. Resetting to default.', error);
            this.resetToDefault();
        }
    }

    _migrateSaveData() {
        const migrations = [
            this._migratePartsInventory.bind(this),
            this._migrateMedalsInventory.bind(this),
            this._migrateMedarots.bind(this),
            this._migratePlayerPosition.bind(this)
        ];

        return migrations.reduce((needsSave, migration) => migration() || needsSave, false);
    }

    _migratePartsInventory() {
        const inv = this.gameData.playerPartsInventory;
        if (inv?.head?.head_001?.name) {
            console.log('Migrating parts inventory...');
            const newInventory = {};
            for (const partType in PARTS_DATA) {
                newInventory[partType] = {};
                for (const partId in PARTS_DATA[partType]) {
                    if (inv[partType]?.[partId]) {
                        newInventory[partType][partId] = { count: 1 };
                    }
                }
            }
            this.gameData.playerPartsInventory = newInventory;
            return true;
        }
        return false;
    }

    _migrateMedalsInventory() {
        if (!this.gameData.playerMedalsInventory || !this.gameData.playerMedalsInventory.kabuto?.count) {
            console.log('Migrating medals inventory...');
            const newMedalsInventory = {};
            for (const medalId in MEDALS_DATA) {
                newMedalsInventory[medalId] = { count: 1 };
            }
            this.gameData.playerMedalsInventory = newMedalsInventory;
            return true;
        }
        return false;
    }

    _migrateMedarots() {
        let updated = false;
        this.gameData.playerMedarots.forEach((medarot, index) => {
            if (!medarot.medalId) {
                medarot.medalId = defaultPlayerMedarots[index]?.medalId || Object.keys(MEDALS_DATA)[0];
                updated = true;
            }
        });
        if (this.gameData.playerMedarots.length < 3) {
            console.log('Completing missing medarots...');
            const existingIds = new Set(this.gameData.playerMedarots.map(m => m.id));
            const medarotsToAppend = defaultPlayerMedarots.filter(m => !existingIds.has(m.id));
            this.gameData.playerMedarots.push(...medarotsToAppend.slice(0, 3 - this.gameData.playerMedarots.length));
            updated = true;
        }
        return updated;
    }

    _migratePlayerPosition() {
        if (this.gameData.playerPosition && !this.gameData.playerPosition.direction) {
            this.gameData.playerPosition.direction = 'down';
            return true;
        }
        return false;
    }

    saveGame() {
        try {
            localStorage.setItem('medarotJSaveData', JSON.stringify(this.gameData));
            console.log('Game data saved successfully.');
        } catch (error) {
            console.error('Failed to save game data.', error);
        }
    }

    getPlayerDataForMap() {
        return {
            position: this.gameData.playerPosition
        };
    }

    getPlayerDataForBattle() {
        return this.gameData.playerMedarots.map(medarot => {
            return {
                name: medarot.name,
                medalId: medarot.medalId,
                set: {
                    name: medarot.set.name,
                    parts: medarot.set.parts
                }
            };
        });
    }

    getMedarot(index) {
        if (!this.gameData.playerMedarots[index]) return null;

        const medarotData = this.gameData.playerMedarots[index];
        const assembledParts = {};

        for (const partSlot in medarotData.set.parts) {
            const partId = medarotData.set.parts[partSlot];
            const masterPartData = buildPartData(partId, partSlot);

            assembledParts[partSlot] = {
                id: partId,
                data: masterPartData
            };
        }

        const equippedMedalId = medarotData.medalId;
        const equippedMedalData = MEDALS_DATA[equippedMedalId] || null;

        return {
            name: medarotData.name,
            parts: assembledParts,
            medal: {
                id: equippedMedalId,
                data: equippedMedalData
            }
        };
    }

    getAvailableParts(partSlot) {
        const inventorySlot = this.gameData.playerPartsInventory[partSlot];
        if (!inventorySlot) return [];
        
        return Object.keys(inventorySlot)
            .map(partId => {
                const masterPartData = buildPartData(partId, partSlot);
                if (!masterPartData) return null;
                return { id: partId, ...masterPartData };
            })
            .filter(part => part !== null);
    }

    getAvailableMedals() {
        const inventory = this.gameData.playerMedalsInventory;
        if (!inventory) return [];

        return Object.keys(inventory)
            .map(medalId => MEDALS_DATA[medalId] || null)
            .filter(medal => medal !== null);
    }

    updateMedarotPart(medarotIndex, partSlot, newPartId) {
        if (this.gameData.playerMedarots[medarotIndex]) {
            this.gameData.playerMedarots[medarotIndex].set.parts[partSlot] = newPartId;
        }
    }

    updateMedarotMedal(medarotIndex, newMedalId) {
        if (this.gameData.playerMedarots[medarotIndex]) {
            this.gameData.playerMedarots[medarotIndex].medalId = newMedalId;
        }
    }

    updatePlayerMapState({ x, y, direction }) {
        if (this.gameData && this.gameData.playerPosition) {
            this.gameData.playerPosition.x = x;
            this.gameData.playerPosition.y = y;
            this.gameData.playerPosition.direction = direction;
        }
    }

    applyBattleResult(battleResult) {
        console.log('Applying battle result:', battleResult);
    }
}