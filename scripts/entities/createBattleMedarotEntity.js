/**
 * @file createBattleMedarotEntity.js
 * @description バトル用のメダロットエンティティを生成する。
 * 各パーツを独立したエンティティとして生成し、IDでリンクさせる形式に変更。
 */

import * as BattleComponents from '../battle/components/index.js';
import * as CommonComponents from '../components/index.js';
import { MEDALS_DATA } from '../data/medals.js';
import { buildPartData } from '../data/partDataUtils.js';
import { PartEntityFactory } from './PartEntityFactory.js';

export function createBattleMedarotEntity(world, medarotData, initialPosition = null, teamId = null, isLeader = false) {
    // 1. 本体エンティティ生成
    const ownerId = world.createEntity();

    const { name, partsIds, medalId } = medarotData;
    let finalName = name;
    let personality = null;

    if (medalId && MEDALS_DATA[medalId]) {
        const medalData = MEDALS_DATA[medalId];
        if (medalData) {
            finalName = medalData.name;
            personality = medalData.personality;
        }
    }

    // 2. パーツエンティティ生成
    // データ構築ユーティリティを使ってマージ済みデータを取得し、Factoryに渡す
    const partKeys = ['head', 'rightArm', 'leftArm', 'legs'];
    const partEntityIds = {};

    partKeys.forEach(key => {
        const partData = buildPartData(partsIds[key], key);
        if (partData) {
            partEntityIds[key] = PartEntityFactory.create(world, ownerId, key, partData);
        } else {
            partEntityIds[key] = null;
        }
    });

    // 3. 本体コンポーネント付与
    world.addComponent(ownerId, new CommonComponents.PlayerInfo(finalName, teamId, isLeader));
    world.addComponent(ownerId, new BattleComponents.Gauge('ACTION'));
    
    // 初期状態タグ
    world.addComponent(ownerId, new BattleComponents.IsCooldown());

    // PartsコンポーネントにはIDを渡す
    world.addComponent(ownerId, new CommonComponents.Parts(
        partEntityIds.head,
        partEntityIds.rightArm,
        partEntityIds.leftArm,
        partEntityIds.legs
    ));

    world.addComponent(ownerId, new BattleComponents.Action());
    world.addComponent(ownerId, new CommonComponents.Medal(personality));
    world.addComponent(ownerId, new BattleComponents.BattleLog());
    
    if (initialPosition) {
        world.addComponent(ownerId, new BattleComponents.Position(initialPosition.x, initialPosition.y));
    }
    
    world.addComponent(ownerId, new BattleComponents.ActiveEffects());
    world.addComponent(ownerId, new BattleComponents.Visual());

    return ownerId;
}