'use strict';

const fs = require('fs');
const path = require('path');

const config = require('./config.json');

module.exports = function AutoVanguard(mod) {
    const cmd = mod.command || mod.require.command;

    // config
    let data = require('./data.json'),
        enable = config.enable,
        playerExclusion = data.playerExclusion;

    let hold = false,
        playerName = '',
        prevState = enable,
        questId = [],
        zoneBg = 0;

    // command
    cmd.add('vg', {
        '$none': () => {
            enable = !enable;
            prevState = enable;
            send(`${enable ? 'En' : 'Dis'}abled`);
        },
        'add': () => {
            playerExclusion.push(playerName);
            data.playerExclusion = playerExclusion;
            saveJsonData();
            enable = false;
            send(`Added player &lt;${playerName}&gt; to be excluded from auto-vanguard completion.`);
        },
        'rm': () => {
            for (let i = 0, n = playerExclusion.length; i < n; i++) {
                if (playerExclusion[i] === playerName) {
                    playerExclusion.splice(i, 1);
                    data.playerExclusion = playerExclusion;
                    saveJsonData();
                    enable = true;
                    send(`Removed player &lt;${playerName}&gt; to be included in auto-vanguard completion.`);
                    return;
                }
            }
            send(`Player &lt;${playerName}&gt; has not been excluded from auto-vanguard completion yet.`);
        },
        '$default': () => send(`Invalid argument. usage : vg [add|rm]`)
    });

    // game state
    mod.hook('S_LOGIN', 12, (e) => {
        playerName = e.name;
        if (!enable)
            return;
        prevState = enable;
        for (let i = 0, n = playerExclusion.length; i < n; i++) {
            if (playerExclusion[i] === playerName) {
                enable = false;
                break;
            }
        }
    });

    mod.hook('S_LOAD_TOPO', 3, (e) => {
        if (e.zone = zoneBg)
            hold = true;
        else if (hold && questId.length !== 0) {
            completeQuest();
            hold = false;
        }
    });

    mod.hook('S_BATTLE_FIELD_ENTRANCE_INFO', 1, (e) => zoneBg = e.zone);

    mod.tryHook('S_EXIT', 'raw', () => {
        enable = prevState;
        questId.length = 0;
    });

    // code
    mod.hook('S_COMPLETE_EVENT_MATCHING_QUEST', 1, (e) => {
        if (!enable)
            return;
        questId.push(e.id);
        if (!hold)
            completeQuest();
        return false;
    });

    // helper
    function completeQuest() {
        while (questId.length > 0) {
            let myId = questId.pop();
            mod.send('C_COMPLETE_DAILY_EVENT', 1, { id: myId });
        }
        setTimeout(() => { mod.send('C_COMPLETE_EXTRA_EVENT', 1, { type: 0 }); }, 500);
        setTimeout(() => { mod.send('C_COMPLETE_EXTRA_EVENT', 1, { type: 1 }); }, 500);
    }

    function saveJsonData() {
        fs.writeFileSync(path.join(__dirname, 'data.json'), JSON.stringify(data));
    }

    function send(msg) { cmd.message(': ' + msg); }

    // reload
    this.saveState = () => {
        let state = {
            enable: enable,
            hold: hold,
            playerName: playerName,
            prevState: prevState,
            questId: questId
        };
        return state;
    }

    this.loadState = (state) => {
        enable = state.enable;
        hold = state.hold;
        playerName = state.playerName;
        prevState = state.prevState
        questId = state.questId;
    }

    this.destructor = () => { cmd.remove('vg'); }

}