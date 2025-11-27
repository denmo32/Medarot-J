import { CONFIG } from '../common/config.js';
import * as Components from '../components/index.js';
import { TeamID, MedalPersonality, PartInfo } from '../common/constants.js'; 
import { PARTS_DATA } from '../../data/parts.js'; 
import { MEDAROT_SETS } from '../../data/medarotSets.js'; 
import { MEDALS_DATA } from '../../data/medals.js';
import { buildPartData } from '../../data/partDataUtils.js';

function generateEnemyPartsIds() {
    const partIds = {};
    for (const partInfo of Object.values(PartInfo)) {
        const partKey = partInfo.key;
        const partIdList = Object.keys(PARTS_DATA[partKey]);
        if (partIdList.length > 0) {
            partIds[partKey] = partIdList[Math.floor(Math.random() * partIdList.length)];
        }
    }
    return partIds;
}

function getPlayerPartsIds(medarotData) {
    const partIds = {};
    const medarotSet = medarotData ? medarotData.set : MEDAROT_SETS[Math.floor(Math.random() * MEDAROT_SETS.length)];

    for (const partKey in medarotSet.parts) {
        const partId = medarotSet.parts[partKey];
        if (PARTS_DATA[partKey] && PARTS_DATA[partKey][partId]) {
            partIds[partKey] = partId;
        }
    }
    return { ids: partIds, nameFallback: medarotSet.name };
}

function determineMedalInfo(teamId, medarotData, nameFallback, totalId) {
    let name = null;
    let personality = null;

    if (teamId === TeamID.TEAM1 && medarotData?.medalId) {
        const medalData = MEDALS_DATA[medarotData.medalId];
        if (medalData) {
            name = medalData.name;
            personality = medalData.personality;
        }
    } else if (teamId === TeamID.TEAM2) {
        const medalKeys = Object.keys(MEDALS_DATA);
        if (medalKeys.length > 0) {
            const randomMedalId = medalKeys[Math.floor(Math.random() * medalKeys.length)];
            const medalData = MEDALS_DATA[randomMedalId];
            if (medalData) {
                name = medalData.name;
                personality = medalData.personality;
            }
        }
    }

    if (!name || !personality) {
        console.warn(`Could not determine name/personality from medal for entity ${totalId}. Falling back.`);
        
        if (teamId === TeamID.TEAM2) {
            name = `エネミー #${totalId}`;
        } else {
            name = medarotData ? medarotData.name : `${nameFallback} #${totalId}`;
        }

        const personalityTypes = Object.values(MedalPersonality);
        personality = personalityTypes[Math.floor(Math.random() * personalityTypes.length)];
    }

    return { name, personality };
}

function createPlayerEntity(world, teamId, index, totalId, medarotData = null) {
    const entityId = world.createEntity();
    const isLeader = index === 0;

    let partIds;
    let nameFallback = '';

    if (teamId === TeamID.TEAM2) {
        partIds = generateEnemyPartsIds();
    } else {
        const result = getPlayerPartsIds(medarotData);
        partIds = result.ids;
        nameFallback = result.nameFallback;
    }

    const { name, personality } = determineMedalInfo(teamId, medarotData, nameFallback, totalId);

    const initializedParts = {
        head: buildPartData(partIds.head, 'head'),
        rightArm: buildPartData(partIds.rightArm, 'rightArm'),
        leftArm: buildPartData(partIds.leftArm, 'leftArm'),
        legs: buildPartData(partIds.legs, 'legs')
    };

    const initialX = teamId === TeamID.TEAM1 ? 0 : 1;
    const yPos = CONFIG.BATTLEFIELD.PLAYER_INITIAL_Y + index * CONFIG.BATTLEFIELD.PLAYER_Y_STEP;

    world.addComponent(entityId, new Components.PlayerInfo(name, teamId, isLeader));
    world.addComponent(entityId, new Components.Gauge());
    world.addComponent(entityId, new Components.GameState());
    world.addComponent(entityId, new Components.Parts(
        initializedParts.head, 
        initializedParts.rightArm, 
        initializedParts.leftArm, 
        initializedParts.legs
    ));
    world.addComponent(entityId, new Components.Action());
    world.addComponent(entityId, new Components.Medal(personality));
    world.addComponent(entityId, new Components.BattleLog());
    world.addComponent(entityId, new Components.Position(initialX, yPos));
    world.addComponent(entityId, new Components.ActiveEffects());

    return entityId;
}

export function createPlayers(world, playerTeamData = null) {
    let idCounter = 0;
    for (const teamId of Object.keys(CONFIG.TEAMS)) {
        for (let i = 0; i < CONFIG.PLAYERS_PER_TEAM; i++) {
            let medarotData = null;
            if (teamId === TeamID.TEAM1 && playerTeamData && playerTeamData[i]) {
                medarotData = playerTeamData[i];
            }
            createPlayerEntity(world, teamId, i, ++idCounter, medarotData);
        }
    }
}