/**
 * @file BattleEntityQueries.js
 * @description メダロット（機体）単位の状態判定やチーム検索を行うヘルパー。
 */
import { Parts, PlayerInfo } from '../../components/index.js';
import { getPartData } from './PartQueries.js';

/**
 * 指定したエンティティが有効なターゲット（頭部が破壊されていない）か判定する
 */
export function isValidTarget(world, targetId, partKey = null) {
    if (targetId === null || targetId === undefined) return false;
    const parts = world.getComponent(targetId, Parts);
    if (!parts) return false;
    
    const headData = getPartData(world, parts.head);
    if (!headData || headData.isBroken) return false;

    if (partKey) {
        const partId = parts[partKey];
        const partData = getPartData(world, partId);
        if (!partData || partData.isBroken) {
            return false;
        }
    }
    return true;
}

/**
 * 攻撃者から見た有効な敵リストを取得する
 */
export function getValidEnemies(world, attackerId) {
    const attackerInfo = world.getComponent(attackerId, PlayerInfo);
    if (!attackerInfo) return [];
    return _getValidEntitiesByTeam(world, attackerInfo.teamId, false);
}

/**
 * 指定した機体から見た有効な味方リストを取得する
 */
export function getValidAllies(world, sourceId, includeSelf = false) {
    const sourceInfo = world.getComponent(sourceId, PlayerInfo);
    if (!sourceInfo) return [];
    const allies = _getValidEntitiesByTeam(world, sourceInfo.teamId, true);
    return includeSelf ? allies : allies.filter(id => id !== sourceId);
}

/**
 * チームIDに基づいて有効なエンティティをフィルタリングする（内部用）
 * @private
 */
export function _getValidEntitiesByTeam(world, sourceTeamId, isAlly) {
    return world.getEntitiesWith(PlayerInfo, Parts)
        .filter(id => {
            const pInfo = world.getComponent(id, PlayerInfo);
            const parts = world.getComponent(id, Parts);
            const isSameTeam = pInfo.teamId === sourceTeamId;
            
            const headData = getPartData(world, parts.head);
            const isAlive = headData && !headData.isBroken;
            
            return (isAlly ? isSameTeam : !isSameTeam) && isAlive;
        });
}
