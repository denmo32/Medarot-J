/**
 * @file BattleStateContext.js
 * @description ゲーム全体の状態を保持するコンポーネント。
 */
export class BattleStateContext {
    constructor() {
        this.isPaused = false; // 一時停止状態
        this.winningTeam = null; // 勝者チーム (例: 'team1', 'team2')
        this.gameMode = 'battle'; // 現在は 'battle' 固定
    }
}