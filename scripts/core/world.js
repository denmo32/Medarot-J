/**
 * @file ECS (Entity-Component-System) アーキテクチャの基盤
 * このファイルは、ゲームの構造設計の中核となるWorldクラスを定義します。
 * ECSは、データをコンポーネント、ロジックをシステムに分離することで、
 * 柔軟で拡張性の高いゲーム開発を可能にするためのデザインパターンです。
 */

/**
 * ゲーム世界のすべてを内包するコンテナであり、オーケストレーターです。
 * エンティティ、コンポーネント、システムの間のやり取りはすべてこのWorldクラスを介して行われます。
 * このクラスが中心的なハブとして機能することで、各要素間の直接的な依存関係をなくし、
 * コードの見通しを良くし、再利用性を高めています。
 */
export class World {
    constructor() {
        // --- Entity & Component Storage ---
        // なぜMapやSetを使うのか？
        // Map: キー(ID)による高速なアクセス(O(1))が可能。エンティティやコンポーネントの検索に適しています。
        // Set: 重複する値を持たないコレクション。エンティティが持つコンポーネントの型を一意に管理するのに適しています。

        // key: entityId, value: そのエンティティが持つコンポーネントクラスのSet
        this.entities = new Map();
        this.nextEntityId = 0;

        // key: componentClass, value: (Map -> key: entityId, value: componentInstance)
        // この二段構えのMap構造により、「特定の型のコンポーネントを持つ、特定のエンティティ」を高速に取得できます。
        this.components = new Map();

        // --- System Storage ---
        // 登録されたすべてのシステムを保持する配列。updateループで順番に実行されます。
        this.systems = [];

        // --- Event Dispatcher ---
        // key: eventName, value: コールバック関数のSet
        // システム間の疎結合を実現するためのイベントリスナーです。
        this.listeners = new Map();
    }

    // === Event Dispatcher Methods ===
    // なぜイベント駆動なのか？
    // システム同士が互いを直接知らなくても、イベントを通じて連携できます。
    // 例えば、InputSystemは「ボタンが押された」というイベントを発行するだけでよく、
    // その結果どのシステムがどう動くかを知る必要がありません。これにより、システムの追加や変更が容易になります。

    /**
     * 指定されたイベント名のイベントリスナー（コールバック）を登録します。
     * @param {string} eventName - 購読するイベントの名前
     * @param {Function} callback - イベント発生時に実行される関数
     */
    on(eventName, callback) {
        if (!this.listeners.has(eventName)) {
            this.listeners.set(eventName, new Set());
        }
        this.listeners.get(eventName).add(callback);
    }

    /**
     * 指定されたイベントを購読しているすべてのリスナーに通知（発行）します。
     * @param {string} eventName - 発行するイベントの名前
     * @param {Object} detail - イベントと共に渡すデータ
     */
    emit(eventName, detail) {
        if (this.listeners.has(eventName)) {
            for (const callback of this.listeners.get(eventName)) {
                callback(detail);
            }
        }
    }

    // === Entity and Component Methods ===

    /**
     * 新しいエンティティを生成します。
     * エンティティは単なる一意なIDであり、それ自体はデータもロジックも持ちません。
     * 「ゲーム内の何か」を識別するための番号札のようなものです。
     * @returns {number} 新しいエンティティID
     */
    createEntity() {
        const entityId = this.nextEntityId++;
        this.entities.set(entityId, new Set());
        return entityId;
    }

    /**
     * 指定されたエンティティにコンポーネントを追加します。
     * コンポーネントは「データ」の入れ物です。エンティティにコンポーネントを追加することで、
     * そのエンティティが「何であるか」「何を持つか」を定義します。
     * @param {number} entityId - コンポーネントを追加するエンティティのID
     * @param {Object} component - 追加するコンポーネントのインスタンス
     */
    addComponent(entityId, component) {
        const componentClass = component.constructor;
        this.entities.get(entityId).add(componentClass);

        if (!this.components.has(componentClass)) {
            this.components.set(componentClass, new Map());
        }
        this.components.get(componentClass).set(entityId, component);
    }

    /**
     * 指定されたエンティティから特定のコンポーネントを取得します。
     * @param {number} entityId - エンティティID
     * @param {Function} componentClass - 取得したいコンポーネントのクラス
     * @returns {Object | undefined} コンポーネントのインスタンス
     */
    getComponent(entityId, componentClass) {
        return this.components.get(componentClass)?.get(entityId);
    }

    /**
     * ワールドに一つしか存在しないシングルトンコンポーネントを取得します。
     * なぜシングルトンが必要か？ GameContextのように、ゲーム全体で共有されるべき唯一の状態を
     * 管理するために使用します。これにより、グローバル変数を避けつつ、どこからでも安全にアクセスできます。
     * @param {Function} componentClass - 取得するコンポーネントのクラス
     * @returns {Object | null} コンポーネントのインスタンス、またはnull
     */
    getSingletonComponent(componentClass) {
        const componentMap = this.components.get(componentClass);
        if (!componentMap || componentMap.size === 0) {
            return null;
        }
        // Mapの最初の要素をシングルトンインスタンスとして返します。
        return componentMap.values().next().value;
    }

    /**
     * 指定されたコンポーネント群をすべて持つエンティティのリストを取得します。
     * このメソッドはECSパターンの強力さを示す中核的な機能です。
     * 「PositionとVelocityを持つすべてのエンティティ」のように、データの組み合わせに基づいて
     * 処理対象を動的に絞り込めるため、データ駆動のロジックを容易に記述できます。
     * @param  {...Function} componentClasses - 検索条件となるコンポーネントクラス（可変長引数）
     * @returns {number[]} 条件に一致したエンティティIDの配列
     */
    getEntitiesWith(...componentClasses) {
        const entities = [];
        if (componentClasses.length === 0) return [];

        // 最もエンティティ数の少ないコンポーネントを基準に検索を始めることで、効率化を図ります。
        let baseComponentMap = this.components.get(componentClasses[0]);
        if (!baseComponentMap) return [];

        for (const entityId of baseComponentMap.keys()) {
            const entityComponents = this.entities.get(entityId);
            if (componentClasses.every(cls => entityComponents.has(cls))) {
                entities.push(entityId);
            }
        }
        return entities;
    }

    /**
     * 指定されたエンティティと、それに関連するすべてのコンポーネントをワールドから削除します。
     * @param {number} entityId - 削除するエンティティのID
     */
    destroyEntity(entityId) {
        const componentClasses = this.entities.get(entityId);
        if (componentClasses) {
            for (const componentClass of componentClasses) {
                this.components.get(componentClass)?.delete(entityId);
            }
        }
        this.entities.delete(entityId);
    }

    // === System Methods ===

    /**
     * システムをワールドに登録します。
     * 登録されたシステムは、`world.update()`が呼ばれるたびに実行されます。
     * @param {Object} system - 登録するシステムのインスタンス
     */
    registerSystem(system) {
        this.systems.push(system);
    }

    /**
     * 登録されているすべてのシステムの`update`メソッドを呼び出します。
     * このメソッドは、ゲームのメインループから毎フレーム呼び出されることを想定しています。
     * これがゲーム世界の時間を進める原動力となります。
     * @param {number} deltaTime - 前のフレームからの経過時間（ミリ秒）
     */
    update(deltaTime) {
        for (const system of this.systems) {
            // システムがupdateメソッドを持っている場合のみ実行します。
            // これにより、イベント駆動のみで動作するシステムがエラーになるのを防ぎます。
            if (system.update) {
                system.update(deltaTime);
            }
        }
    }
}
