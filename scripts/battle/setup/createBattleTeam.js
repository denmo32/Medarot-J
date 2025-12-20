/**
 * @file createBattleTeam.js
 * @description バトルシーンのチーム全体のメダロットを生成する関数
 */

import { CONFIG } from '../common/config.js';
import { createBattleMedarotEntity } from '../../entities/createBattleMedarotEntity.js';
import { TeamID, PartInfo } from '../../common/constants.js';
import { PARTS_DATA } from '../../data/parts.js';
import { MEDALS_DATA } from '../../data/medals.js';
import { MedalPersonality } from '../../common/constants.js';

/**
 * チーム全体のメダロットを生成する
 * @param {Object} world - ECSワールド
 * @param {Array} playerTeamData - プレイヤーチームのデータ
 */
export function createBattleTeam(world, playerTeamData = null) {
    for (const teamIdString of Object.keys(CONFIG.TEAMS)) {
        const teamId = /** @type {TeamID} */ (teamIdString);
        for (let i = 0; i < CONFIG.PLAYERS_PER_TEAM; i++) {
            const isLeader = i === 0;

            // 位置を計算
            const initialX = teamId === TeamID.TEAM1 ? 0 : 1;
            const yPos = CONFIG.BATTLEFIELD.PLAYER_INITIAL_Y + i * CONFIG.BATTLEFIELD.PLAYER_Y_STEP;
            const initialPosition = { x: initialX, y: yPos };

            let finalMedarotData = null;

            if (teamId === TeamID.TEAM1) {
                // プレイヤー (TEAM1) の場合
                if (playerTeamData && playerTeamData[i]) {
                    const originalData = playerTeamData[i];
                    // createBattleMedarotEntity が期待する形式に変換
                    finalMedarotData = {
                        name: originalData.name,
                        partsIds: originalData.set.parts, // set.parts を partsIds にマッピング
                        medalId: originalData.medalId,
                        // 必要に応じて personality も含める
                    };
                } else {
                    // データがない場合はエラー or ダミーデータ
                    console.error(`No medarotData found for TEAM1 player at index ${i}. Skipping.`);
                    continue;
                }
            } else if (teamId === TeamID.TEAM2) {
                // 敵 (TEAM2) の場合、ランダムデータを生成
                const partKeys = Object.values(PartInfo).map(p => p.key);
                const partIds = {};
                for (const partKey of partKeys) {
                    const partIdList = Object.keys(PARTS_DATA[partKey]);
                    if (partIdList.length > 0) {
                        partIds[partKey] = partIdList[Math.floor(Math.random() * partIdList.length)];
                    }
                }

                // メダル情報もランダム
                const medalKeys = Object.keys(MEDALS_DATA);
                let name = `エネミー #${i}`; // フォールバック名
                let personality = null;
                if (medalKeys.length > 0) {
                    const randomMedalId = medalKeys[Math.floor(Math.random() * medalKeys.length)];
                    const medalData = MEDALS_DATA[randomMedalId];
                    if (medalData) {
                        name = medalData.name;
                        personality = medalData.personality;
                    }
                }

                // personality が未設定の場合のフォールバック
                if (!personality) {
                    const personalityTypes = Object.values(MedalPersonality);
                    personality = personalityTypes[Math.floor(Math.random() * personalityTypes.length)];
                }

                finalMedarotData = {
                    name: name,
                    partsIds: partIds,
                    medalId: null, // ランダムに決定したのでmedalIdは直接は使わないが、プロパティとして持たせてもよい
                    // 必要に応じて personality も finalMedarotData に含める
                };
            } else {
                // 未知のチームID
                console.error(`Unknown team ID: ${teamId}. Skipping player at index ${i}.`);
                continue;
            }

            // 新しい関数を呼び出す
            createBattleMedarotEntity(world, finalMedarotData, initialPosition, teamId, isLeader);
        }
    }
}