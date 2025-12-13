/**
 * @file PersistenceService.js
 * @description ゲームデータの永続化（保存・読み込み）を担当するサービス。
 */

import { MEDAROT_SETS } from '../data/medarotSets.js';
import { PARTS_DATA } from '../data/parts.js';
import { MEDALS_DATA } from '../data/medals.js';
import { buildPartData } from '../data/partDataUtils.js';

// デフォルトのプレイヤー初期位置
const initialPlayerPosition = {
    x: 1 * 32 + (32 - 24) / 2, // TILE_SIZE, PLAYER_SIZE
    y: 1 * 32 + (32 - 24) / 2,
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

export class PersistenceService {
    constructor() {}

    /**
     * デフォルトのゲームデータを生成して返す
     * @returns {object}
     */
    reset() {
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

        const defaultData = {
            playerPosition: { ...initialPlayerPosition },
            playerMedarots: medarots,
            playerPartsInventory: inventory,
            playerMedalsInventory: medalsInventory,
        };
        console.log('Default game data generated.');
        return defaultData;
    }

    /**
     * ゲームデータをlocalStorageから読み込む
     * @returns {object}
     */
    load() {
        try {
            const savedData = localStorage.getItem('medarotJSaveData');
            if (savedData) {
                const gameData = JSON.parse(savedData);
                console.log('Game data loaded from localStorage.', gameData);

                if (this._migrateSaveData(gameData)) {
                    this.save(gameData); // माइग्रेशन後に保存
                }
                return gameData;
            } else {
                console.log('No save data found. Initializing with default data.');
                return this.reset();
            }
        } catch (error) {
            console.error('Failed to load game data. Resetting to default.', error);
            return this.reset();
        }
    }

    /**
     * ゲームデータをlocalStorageに保存する
     * @param {object} gameData
     */
    save(gameData) {
        try {
            localStorage.setItem('medarotJSaveData', JSON.stringify(gameData));
            console.log('Game data saved successfully.');
        } catch (error) {
            console.error('Failed to save game data.', error);
        }
    }

    _migrateSaveData(gameData) {
        const migrations = [
            this._migratePartsInventory.bind(this),
            this._migrateMedalsInventory.bind(this),
            this._migrateMedarots.bind(this),
            this._migratePlayerPosition.bind(this)
        ];

        return migrations.reduce((needsSave, migration) => migration(gameData) || needsSave, false);
    }

    _migratePartsInventory(gameData) {
        const inv = gameData.playerPartsInventory;
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
            gameData.playerPartsInventory = newInventory;
            return true;
        }
        return false;
    }

    _migrateMedalsInventory(gameData) {
        if (!gameData.playerMedalsInventory || !gameData.playerMedalsInventory.kabuto?.count) {
            console.log('Migrating medals inventory...');
            const newMedalsInventory = {};
            for (const medalId in MEDALS_DATA) {
                newMedalsInventory[medalId] = { count: 1 };
            }
            gameData.playerMedalsInventory = newMedalsInventory;
            return true;
        }
        return false;
    }

    _migrateMedarots(gameData) {
        let updated = false;
        gameData.playerMedarots.forEach((medarot, index) => {
            if (!medarot.medalId) {
                medarot.medalId = defaultPlayerMedarots[index]?.medalId || Object.keys(MEDALS_DATA)[0];
                updated = true;
            }
        });
        if (gameData.playerMedarots.length < 3) {
            console.log('Completing missing medarots...');
            const existingIds = new Set(gameData.playerMedarots.map(m => m.id));
            const medarotsToAppend = defaultPlayerMedarots.filter(m => !existingIds.has(m.id));
            gameData.playerMedarots.push(...medarotsToAppend.slice(0, 3 - gameData.playerMedarots.length));
            updated = true;
        }
        return updated;
    }

    _migratePlayerPosition(gameData) {
        if (gameData.playerPosition && !gameData.playerPosition.direction) {
            gameData.playerPosition.direction = 'down';
            return true;
        }
        return false;
    }
}