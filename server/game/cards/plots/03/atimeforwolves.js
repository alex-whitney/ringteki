const _ = require('underscore');

const PlotCard = require('../../../plotcard.js');

class ATimeForWolves extends PlotCard {
    onReveal(player) {
        if(!this.inPlay || this.owner !== player) {
            return true;
        }

        var direwolfCards = player.searchDrawDeck(card => {
            return card.hasTrait('Direwolf');
        });

        var buttons = _.map(direwolfCards, card => {
            return { text: card.name, command: 'menuButton', method: 'cardSelected', arg: card.uuid };
        });

        buttons.push({ text: 'Done', command: 'menuButton', method: 'doneSelecting' });

        this.game.promptWithMenu(player, this, {
            activePrompt: {
                menuTitle: 'Select a card to add to your hand',
                buttons: buttons
            },
            waitingPromptTitle: 'Waiting for opponent to use ' + this.name
        });

        return false;
    }

    cardSelected(player, cardId) {
        var card = player.findCardByUuid(player.drawDeck, cardId);

        if(!card) {
            return false;
        }

        player.moveFromDrawDeckToHand(card);
        player.shuffleDrawDeck();

        if(card.getCost() > 3) {
            this.game.addMessage('{0} uses {1} to reveal {2} and add it to their hand', player, this, card);
            return true;
        }

        this.revealedCard = card;

        var buttons = [
            { text: 'Keep in hand', command: 'menuButton', method: 'keepInHand' },
            { text: 'Put in play', command: 'menuButton', method: 'putInPlay' }
        ];

        this.game.promptWithMenu(player, this, {
            activePrompt: {
                menuTitle: 'Put card into play?',
                buttons: buttons
            },

            waitingPromptTitle: 'Waiting for opponent to use ' + this.name
        });

        return true;
    }

    keepInHand(player) {
        if(!this.revealedCard) {
            return false;
        }

        this.game.addMessage('{0} uses {1} to reveal {2} and add it to their hand', player, this, this.revealedCard);
        this.revealedCard = null;

        return true;
    }

    putInPlay(player) {
        if(!this.revealedCard) {
            return false;
        }

        this.game.addMessage('{0} uses {1} to reveal {2} and put it in play', player, this, this.revealedCard);
        player.playCard(this.revealedCard.uuid, true, player.hand);
        this.revealedCard = null;

        return true;
    }

    doneSelecting(player) {
        player.shuffleDrawDeck();
        this.game.addMessage('{0} does not use {1} to find a card', player, this);
        return true;
    }
}

ATimeForWolves.code = '03046';

module.exports = ATimeForWolves;