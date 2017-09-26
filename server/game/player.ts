import * as _ from 'underscore';

import { Spectator } from './spectator';
import * as Deck from './deck';
import * as AttachmentPrompt from './gamesteps/attachmentprompt';
import * as ConflictTracker  from './conflicttracker';
import * as PlayableLocation from './playablelocation';
import * as PlayActionPrompt from './gamesteps/playactionprompt';
import * as PlayerPromptState from './playerpromptstate';
import * as StrongholdCard from './strongholdcard';

const StartingHandSize = 4;
const DrawPhaseCards = 1;

// THIS DOES NOT BELONG HERE
export const enum GameLocation {
    Hand = 'hand',
    ConflictDeck = 'conflict deck',
    DynastyDeck = 'dynasty deck',
    ConflictDiscardPile = 'conflict discard pile',
    DynastyDiscardPile = 'dynasty discard pile',
    PlayArea = 'play area',
    ProvinceOne = 'province 1',
    ProvinceTwo = 'province 2',
    ProvinceThree = 'province 3',
    ProvinceFour = 'province 4',
    StrongholdProvince = 'stronghold province',
    ProvinceDeck = 'province deck'
}

export interface PlayerSummary {
    additionalPiles;
    promptedActionWindows;
    cardsInPlay;
    conflictDeck;
    dynastyDeck;
    conflictDiscardPile;
    dynastyDiscardPile;
    disconnected;
    faction;
    stronghold;
    firstPlayer;
    fate;
    hand;
    id;
    imperialFavor;
    left;
    numConflictCards;
    numDynastyCards;
    name;
    numProvinceCards;
    phase?;
    provinceDeck;
    provinces;
    showBid;
    strongholdProvince;
    totalHonor;
    timerSettings;
    user;
    showConflictDeck?;
    showDynastyDeck?;
    role?;
}

export class Player extends Spectator {
    dynastyDeck: _.Underscore<any> = _([]);
    conflictDeck: _.Underscore<any> = _([]);
    provinceDeck: _.Underscore<any> = _([]);
    hand: _.Underscore<any> = _([]);
    cardsInPlay: _.Underscore<any> = _([]);
    strongholdProvince: _.Underscore<any> = _([]);
    provinceOne: _.Underscore<any> = _([]);
    provinceTwo: _.Underscore<any> = _([]);
    provinceThree: _.Underscore<any> = _([]);
    provinceFour: _.Underscore<any> = _([]);
    dynastyDiscardPile: _.Underscore<any> = _([]);
    conflictDiscardPile: _.Underscore<any> = _([]);
    additionalPiles: any = {};
    allCards: _.Underscore<any>;

    faction: object = {};
    stronghold;
    role;

    owner;
    game;

    takenDynastyMulligan: boolean = false;
    takenConflictMulligan: boolean = false;
    passedDynasty: boolean = false;
    honorBid: number = 0;
    showBid: number = 0;
    imperialFavor: string = '';
    totalGloryForFavor: number = 0;
    drawPhaseCards: number;

    deck: any = {};
    conflicts;
    minReserve: number = 0;
    costReducers: Array<any> = [];
    playableLocations: Array<any>;

    cannotGainConflictBonus: boolean = false;
    cannotTriggerCardAbilities: boolean = false;

    promptedActionWindows;
    timerSettings;
    keywordSettings;
    promptState;

    fate = 0;
    honor = 0;
    readyToStart = false;
    limitedPlayed = 0;
    maxLimited = 1;
    firstPlayer: boolean;

    resetTimerAtEndOfRound: boolean;
    roundDone: boolean;
    noTimer: boolean;
    conflictLimit: number;

    showConflict: boolean;
    showDynasty: boolean;

    // What are these? They are not set in this file, but are part of the summary
    left;
    phase;
    disconnected;

    constructor(id, user, owner, game) {
        super(id, user);

        this.stronghold = new StrongholdCard(this, {});

        this.owner = owner;
        this.game = game;

        this.conflicts = new ConflictTracker();
        this.playableLocations = [
            new PlayableLocation('play', this, 'hand'),
            new PlayableLocation('dynasty', this, 'province 1'),
            new PlayableLocation('dynasty', this, 'province 2'),
            new PlayableLocation('dynasty', this, 'province 3'),
            new PlayableLocation('dynasty', this, 'province 4')
        ];
        this.promptedActionWindows = user.promptedActionWindows || {
            dynasty: true,
            draw: true,
            preConflict: true,
            conflict: true,
            fate: true,
            regroup: true
        };
        this.timerSettings = user.settings.timerSettings || {};
        this.timerSettings.windowTimer = user.settings.windowTimer;
        this.keywordSettings = user.settings.keywordSettings;

        this.createAdditionalPile('out of game', { title: 'Out of Game', area: 'player row' });

        this.promptState = new PlayerPromptState();
    }

    isCardUuidInList(list, card) {
        return list.any(c => {
            return c.uuid === card.uuid;
        });
    }

    isCardNameInList(list, card) {
        return list.any(c => {
            return c.name === card.name;
        });
    }

    areCardsSelected() {
        return this.cardsInPlay.any(card => {
            return card.selected;
        });
    }

    removeCardByUuid(list, uuid) {
        return _(list.reject(card => {
            return card.uuid === uuid;
        }));
    }

    findCardByName(list, name) {
        return this.findCard(list, card => card.name === name);
    }

    findCardByUuidInAnyList(uuid) {
        return this.findCardByUuid(this.allCards, uuid);
    }

    findCardByUuid(list, uuid) {
        return this.findCard(list, card => card.uuid === uuid);
    }

    findCardInPlayByUuid(uuid) {
        return this.findCard(this.cardsInPlay, card => card.uuid === uuid);
    }

    findCard(cardList, predicate) {
        var cards = this.findCards(cardList, predicate);
        if(!cards || _.isEmpty(cards)) {
            return undefined;
        }

        return cards[0];
    }

    findCards(cardList, predicate) {
        if(!cardList) {
            return;
        }

        var cardsToReturn = [];

        cardList.each(card => {
            if(predicate(card)) {
                cardsToReturn.push(card);
            }

            if(card.attachments) {
                cardsToReturn = cardsToReturn.concat(card.attachments.filter(predicate));
            }

            return cardsToReturn;
        });

        return cardsToReturn;
    }

    attachStronghold() {
        this.moveCard(this.stronghold, GameLocation.StrongholdProvince);
    }

    fillProvinces() {
        const provinces = [
            GameLocation.ProvinceOne,
            GameLocation.ProvinceTwo,
            GameLocation.ProvinceThree,
            GameLocation.ProvinceFour
        ];

        _.each(provinces, province => {
            // Because all player locations are wrapped on creation we need to unwrap them
            if(_.find<any>(this.getSourceList(province)._wrapped, card => {
                if(card.isDynasty) {
                    card.facedown = true;
                }
                return card.isDynasty;
            })) {
                //Noop
            } else {
                this.moveCard(this.dynastyDeck.first(), province);
            }
        });
    }

    discardFromBrokenProvinces() {
        const provinces = [
            GameLocation.ProvinceOne,
            GameLocation.ProvinceTwo,
            GameLocation.ProvinceThree,
            GameLocation.ProvinceFour
        ];

        _.each(provinces, province => {
            let provinceCard = _.find<any>(this.getSourceList(province)._wrapped, card => card.isProvince);
            if(provinceCard.isBroken) {
                _.find<any>(this.getSourceList(province)._wrapped, card => {
                    if(card.isDynasty && !card.facedown) {
                        this.moveCard(card,GameLocation.DynastyDiscardPile);
                        this.moveCard(this.dynastyDeck.first(), province);
                    }
                    return card.isDynasty;
                });
            }
        });        
    }
    
    anyCardsInPlay(predicate) {
        return this.allCards.any(card => card.location === 'play area' && predicate(card));
    }

    filterCardsInPlay(predicate) {
        return this.allCards.filter(card => card.location === 'play area' && predicate(card));
    }

    getNumberOfCardsInPlay(predicate) {
        return this.allCards.reduce((num, card) => {
            if(card.location === 'play area' && predicate(card)) {
                return num + 1;
            }

            return num;
        }, 0);
    }

    isCardInPlayableLocation(card, playingType) {
        return _.any(this.playableLocations, location => location.playingType === playingType && location.contains(card));
    }

    getDuplicateInPlay(card) {
        if(!card.isUnique()) {
            return undefined;
        }

        return this.findCard(this.cardsInPlay, playCard => {
            return playCard !== card && (playCard.id === card.id || playCard.name === card.name);
        });
    }

    getNumberOfConflictsWon(conflictType) {
        return this.conflicts.getWon(conflictType);
    }

    getNumberOfConflictsLost(conflictType) {
        return this.conflicts.getLost(conflictType);
    }

    getNumberOfConflictsInitiatedByType(conflictType) {
        return this.conflicts.getPerformed(conflictType);
    }

    getNumberOfConflictsInitiated() {
        return this.conflicts.complete;
    }

    drawCardsToHand(numCards) {
        let remainingCards = 0;
        
        if(numCards > this.conflictDeck.size()) {
            remainingCards = numCards - this.conflictDeck.size();
            numCards = this.conflictDeck.size();
        }

        var cards = this.conflictDeck.first(numCards);
        _.each(cards, card => {
            this.moveCard(card, GameLocation.Hand);
        });

        if(this.game.currentPhase !== 'setup') {
            this.game.raiseEvent('onCardsDrawn', { cards: cards, player: this });
        }

        if(remainingCards > 0) {
            this.deckRanOutOfCards('conflict');
            let moreCards = this.conflictDeck.first(remainingCards);
            _.each(moreCards, card => this.moveCard(card, GameLocation.Hand));
            cards = _.extend(cards, moreCards);
        }

        return (cards.length > 1) ? cards : cards[0];
    }
    
    deckRanOutOfCards(deck) {
        this.game.addMessage('{0}\'s {1} deck has run out of cards and is being reshuffled. {0} loses 5 honor', this, deck);
        let deckLocation = GameLocation.DynastyDeck;
        let discardLocation = GameLocation.DynastyDiscardPile;
        if (deck === 'conflict') {
            deckLocation = GameLocation.ConflictDeck;
            discardLocation = GameLocation.ConflictDiscardPile;
        }
        _.each(this.getSourceList(discardLocation)._wrapped, card => this.moveCard(card, deckLocation));
        _.shuffle(this.getSourceList(deckLocation));
        this.game.addHonor(this, -5);
    }

    replaceDynastyCard(location) {
        if(this.dynastyDeck.size() === 0) {
            this.deckRanOutOfCards('dynasty');
        }
        this.moveCard(this.dynastyDeck.first(), location);        
    }

    searchConflictDeck(limit, predicate) {
        var cards = this.conflictDeck;

        if(_.isFunction(limit)) {
            predicate = limit;
        } else {
            if(limit > 0) {
                cards = _(this.conflictDeck.first(limit));
            } else {
                cards = _(this.conflictDeck.last(-limit));
            }
        }

        return cards.filter(predicate);
    }

    searchDynastyDeck(limit, predicate) {
        var cards = this.dynastyDeck;

        if(_.isFunction(limit)) {
            predicate = limit;
        } else {
            if(limit > 0) {
                cards = _(this.dynastyDeck.first(limit));
            } else {
                cards = _(this.dynastyDeck.last(-limit));
            }
        }

        return cards.filter(predicate);
    }

    shuffleConflictDeck() {
        this.conflictDeck = _(this.conflictDeck.shuffle());
    }

    shuffleDynastyDeck() {
        this.dynastyDeck = _(this.dynastyDeck.shuffle());
    }

    discardFromConflict(number, callback: { (card): any } = () => true) {
        number = Math.min(number, this.conflictDeck.size());

        var cards = this.conflictDeck.first(number);
        this.discardCards(cards, false, discarded => {
            callback(discarded);
            if(this.conflictDeck.size() === 0) {
                this.game.playerDecked(this);
            }
        });
    }

    moveFromTopToBottomOfConflictDrawDeck(number) {
        while(number > 0) {
            this.moveCard(this.conflictDeck.first(), GameLocation.ConflictDeck, { bottom: true });

            number--;
        }
    }

    discardAtRandom(number, callback: { (card): any } = () => true) {
        var toDiscard = Math.min(number, this.hand.size());
        var cards = [];

        while(cards.length < toDiscard) {
            var cardIndex = _.random(0, this.hand.size() - 1);

            var card = this.hand.value()[cardIndex];
            if(!cards.includes(card)) {
                cards.push(card);
            }
        }

        this.discardCards(cards, false, discarded => {
            this.game.addMessage('{0} discards {1} at random', this, discarded[0]);
            callback(discarded);
        });
    }

    canInitiateConflict(conflictType) {
        return (!this.conflicts.isAtMax(conflictType) && 
                this.conflicts.conflictOpportunities > 0);
    }

    addConflict(type, number) {
        this.conflicts.modifyMaxForType(type, number);
    }

    setMaxConflict(number) {
        this.conflicts.setMax(number);
    }

    clearMaxConflict() {
        this.conflicts.clearMax();
    }

    setCannotInitiateConflictForType(type, value) {
        this.conflicts.setCannotInitiateForType(type, value);
    }

    initConflictDeck() {
        this.shuffleConflictDeck();
    }
    
    drawStartingHand() {
        this.drawCardsToHand(StartingHandSize);
    }

    initDynastyDeck() {
        this.shuffleDynastyDeck();
    }

    prepareDecks() {
        var deck = new Deck(this.deck);
        var preparedDeck = deck.prepare(this);
        this.faction = preparedDeck.faction;
        this.provinceDeck = _(preparedDeck.provinceCards);
        this.stronghold = preparedDeck.stronghold;
        this.role = preparedDeck.role;
        this.conflictDeck = _(preparedDeck.conflictCards);
        this.dynastyDeck = _(preparedDeck.dynastyCards);
        this.allCards = _(preparedDeck.allCards);
    }

    initialise() {
        this.prepareDecks();
        this.initConflictDeck();
        this.initDynastyDeck();

        this.fate = 0;
        this.honor = 0;
        this.readyToStart = false;
        this.limitedPlayed = 0;
        this.maxLimited = 1;
    }

    startGame() {
        if(!this.readyToStart) {
            return;
        }

        this.honor = this.stronghold.cardData.honor;
        //this.game.raiseEvent('onStatChanged', this, 'honor');
    }

    dynastyMulligan(cards) {
        if(this.takenDynastyMulligan) {
            return false;
        }

        _.each(cards, card => {
            this.removeCardFromPile(card);
        });

        this.takenDynastyMulligan = true;

        this.fillProvinces();

        _.each<any>(cards, card => {
            card.moveTo('dynasty deck');
            this.dynastyDeck.value<any>().push(card);
        });

        this.shuffleDynastyDeck();

        this.game.addMessage('{0} has mulliganed {1} cards from the dynasty deck', this.name, cards.length);
    }

    dynastyKeep() {
        this.game.addMessage('{0} has kept all dynasty cards', this.name);
        this.takenDynastyMulligan = true;
    }

    conflictMulligan(cards) {
        if(this.takenConflictMulligan) {
            return false;
        }

        _.each(cards, card => {
            this.removeCardFromPile(card);
        });

        this.drawCardsToHand(cards.length);

        _.each<any>(cards, card => {
            card.moveTo('conflict deck');
            this.conflictDeck.value<any>().push(card);
        });

        this.shuffleConflictDeck();

        this.game.addMessage('{0} has mulliganed {1} cards from the conflict deck', this.name, cards.length);
        this.takenConflictMulligan = true;
        this.readyToStart = true;
    }

    conflictKeep() {
        this.game.addMessage('{0} has kept all conflict cards', this.name);
        this.takenConflictMulligan = true;
        this.readyToStart = true;
    }

    addCostReducer(reducer) {
        this.costReducers.push(reducer);
    }

    removeCostReducer(reducer) {
        if(_.contains(this.costReducers, reducer)) {
            reducer.unregisterEvents();
            this.costReducers = _.reject(this.costReducers, r => r === reducer);
        }
    }

    getReducedCost(playingType, card) {
        var baseCost = card.getCost();
        var matchingReducers = _.filter(this.costReducers, reducer => reducer.canReduce(playingType, card));
        var reducedCost = _.reduce(matchingReducers, (cost, reducer) => cost - reducer.getAmount(card), baseCost);
        return Math.max(reducedCost, 0);
    }

    markUsedReducers(playingType, card) {
        var matchingReducers = _.filter(this.costReducers, reducer => reducer.canReduce(playingType, card));
        _.each(matchingReducers, reducer => {
            reducer.markUsed();
            if(reducer.isExpired()) {
                this.removeCostReducer(reducer);
            }
        });
    }

    playCard(card) {
        if(!card) {
            return false;
        }

        var context = {
            game: this.game,
            player: this,
            source: card
        };

        var playActions = _.filter<any>(card.getPlayActions(), action => action.meetsRequirements(context) && action.canPayCosts(context) && action.canResolveTargets(context));

        if(playActions.length === 0) {
            return false;
        }

        if(playActions.length === 1) {
            this.game.resolveAbility(playActions[0], context);
        } else {
            this.game.queueStep(new PlayActionPrompt(this.game, this, playActions, context));
        }

        return true;
    }

    canPutIntoPlay(card) {
        if(!card.isUnique()) {
            return true;
        }

        return !_.any<any>(this.game.getPlayers(), player => {
            return player.anyCardsInPlay(c => (
                c.name === card.name
                && ((c.owner === this || c.controller === this)
                    || (c.owner === card.owner))
                && c !== card
            ));
        });
    }

    putIntoPlay(card, playingType = 'play') {
        if(!this.canPutIntoPlay(card)) {
            return;
        }

        if(card.getType() === 'attachment') {
            this.promptForAttachment(card, playingType);
            return;
        }

        let originalLocation = card.location;

        card.new = true;
        this.moveCard(card, GameLocation.PlayArea);
        if(card.controller !== this) {
            card.controller.allCards = _(card.controller.allCards.reject(c => c === card));
            this.allCards.value<any>().push(card);
        }
        card.controller = this;

        card.applyPersistentEffects();

        this.game.raiseEvent('onCardEntersPlay', { card: card, playingType: playingType, originalLocation: originalLocation });
    }

    setupBegin() {
        this.firstPlayer = false;
    }

    drawPhase() {
        this.drawPhaseCards = this.honorBid;
        this.game.addMessage('{0} draws {1} cards for the draw phase', this, this.drawPhaseCards);
        this.drawCardsToHand(this.drawPhaseCards);
    }

    beginDynasty() {
        this.roundDone = false;

        if(this.resetTimerAtEndOfRound) {
            this.noTimer = false;
        }

        this.conflicts.reset();

        this.conflictLimit = 0;
        this.drawPhaseCards = DrawPhaseCards;

        this.cardsInPlay.each(card => {
            card.new = false;
        });

        this.game.addFate(this, this.getTotalIncome());

        this.game.raiseEvent('onIncomeCollected', { player: this });

        this.passedDynasty = false;
        this.limitedPlayed = 0;
    }

    hasUnmappedAttachments() {
        return this.cardsInPlay.any(card => {
            return card.getType() === 'attachment';
        });
    }

    canAttach(attachment, card) {
        if(!attachment || !card) {
            return false;
        }

        return (
            card.location === 'play area' &&
            card !== attachment &&
            card.allowAttachment(attachment) &&
            attachment.canAttach(this, card)
        );
    }


    attach(player, attachment, card, playingType) {
        if(!card || !attachment) {
            return;
        }

        if(!this.canAttach(attachment, card)) {
            return;
        }

        let originalLocation = attachment.location;
        let originalParent = attachment.parent;

        attachment.owner.removeCardFromPile(attachment);
        if(originalParent) {
            originalParent.removeAttachment(attachment);
        }
        attachment.moveTo('play area', card);
        card.attachments.push(attachment);
        attachment.parent = card;

        this.game.queueSimpleStep(() => {
            attachment.applyPersistentEffects();
        });
        
        if(attachment.printedKeywords.includes('restricted') && _.size(_.filter<any>(card.attachments._wrapped, card => card.isRestricted())) > 1) {
            this.game.promptForSelect(this, {
                activePromptTitle: 'Choose a card to discard',
                waitingPromptTitle: 'Waiting for opponent to choose a card to discard',
                cardCondition: c => c.parent === card && c.isRestricted(),
                onSelect: (player, card) => {
                    player.discardCard(card);
                    return true;
                },
                source: 'Too many Restricted attachments'
            });
        }

        if(originalLocation !== 'play area') {
            this.game.raiseEvent('onCardEntersPlay', { card: attachment, playingType: playingType, originalLocation: originalLocation });
        }

        this.game.raiseEvent('onCardAttached', { card: attachment, parent: card });
    }

    showConflictDeck() {
        this.showConflict = true;
    }

    showDynastyDeck() {
        this.showDynasty = true;
    }

    isValidDropCombination(source: GameLocation, target: GameLocation) {
        const provinceList = [
            GameLocation.ProvinceOne,
            GameLocation.ProvinceTwo,
            GameLocation.ProvinceThree,
            GameLocation.ProvinceFour,
            GameLocation.StrongholdProvince
        ];

        if(source === GameLocation.ProvinceDeck && !_.isEmpty(_.intersection(provinceList, target))) {
            return false;
        }

        if(target === GameLocation.ProvinceDeck && !_.isEmpty(_.intersection(provinceList, source))) {
            return false;
        }

        return source !== target;
    }

    getSourceList(source: GameLocation) {
        switch(source) {
            case GameLocation.Hand:
                return this.hand;
            case GameLocation.ConflictDeck:
                return this.conflictDeck;
            case GameLocation.DynastyDeck:
                return this.dynastyDeck;
            case GameLocation.ConflictDiscardPile:
                return this.conflictDiscardPile;
            case GameLocation.DynastyDiscardPile:
                return this.dynastyDiscardPile;
            case GameLocation.PlayArea:
                return this.cardsInPlay;
            case GameLocation.ProvinceOne:
                return this.provinceOne;
            case GameLocation.ProvinceTwo:
                return this.provinceTwo;
            case GameLocation.ProvinceThree:
                return this.provinceThree;
            case GameLocation.ProvinceFour:
                return this.provinceFour;
            case GameLocation.StrongholdProvince:
                return this.strongholdProvince;
            case GameLocation.ProvinceDeck:
                return this.provinceDeck;
            default:
                if(this.additionalPiles[source]) {
                    return this.additionalPiles[source].cards;
                }
        }
    }

    createAdditionalPile(name, properties) {
        this.additionalPiles[name] = _.extend({ cards: _([]) }, properties);
    }

    updateSourceList(source: GameLocation, targetList) {
        switch(source) {
            case GameLocation.Hand:
                this.hand = targetList;
                break;
            case GameLocation.ConflictDeck:
                this.conflictDeck = targetList;
                break;
            case GameLocation.DynastyDeck:
                this.dynastyDeck = targetList;
                break;
            case GameLocation.ConflictDiscardPile:
                this.conflictDiscardPile = targetList;
                break;
            case GameLocation.DynastyDiscardPile:
                this.dynastyDiscardPile = targetList;
                break;
            case GameLocation.PlayArea:
                this.cardsInPlay = targetList;
                break;
            case GameLocation.ProvinceOne:
                this.provinceOne = targetList;
                break;
            case GameLocation.ProvinceTwo:
                this.provinceTwo = targetList;
                break;
            case GameLocation.ProvinceThree:
                this.provinceThree = targetList;
                break;
            case GameLocation.ProvinceFour:
                this.provinceFour = targetList;
                break;
            case GameLocation.StrongholdProvince:
                this.strongholdProvince = targetList;
                break;
            case GameLocation.ProvinceDeck:
                this.provinceDeck = targetList;
                break;
            default:
                if(this.additionalPiles[source]) {
                    this.additionalPiles[source].cards = targetList;
                }
        }
    }

    drop(cardId, source: GameLocation, target: GameLocation) {
        if(!this.isValidDropCombination(source, target)) {
            return false;
        }

        var sourceList = this.getSourceList(source);
        var card = this.findCardByUuid(sourceList, cardId);

        if(!card) {
            if(source === GameLocation.PlayArea) {
                var otherPlayer = this.game.getOtherPlayer(this);

                if(!otherPlayer) {
                    return false;
                }

                card = otherPlayer.findCardInPlayByUuid(cardId);

                if(!card) {
                    return false;
                }
            } else {
                return false;
            }
        }

        if(card.controller !== this) {
            return false;
        }

        if(target === GameLocation.PlayArea && card.getType() === 'event') {
            return false;
        }

        if(target === GameLocation.PlayArea) {
            this.putIntoPlay(card);
        } else {
            if(target === GameLocation.ConflictDiscardPile) {
                this.discardCard(card, false);
                return true;
            }

            if(target === GameLocation.DynastyDiscardPile) {
                this.discardCard(card, false);
                return true;
            }

            this.moveCard(card, target);
        }

        return true;
    }

    promptForAttachment(card, playingType) {
        // TODO: Really want to move this out of here.
        this.game.queueStep(new AttachmentPrompt(this.game, this, card, playingType));
    }

    beginConflict() {
        this.cardsInPlay.each(card => {
            card.resetForConflict();
        });
    }

    initiateConflict(conflictType) {
        this.conflicts.perform(conflictType);
    }

    winConflict(conflictType, wasAttacker) {
        this.conflicts.won(conflictType, wasAttacker);
    }

    loseConflict(conflictType, wasAttacker) {
        this.conflicts.lost(conflictType, wasAttacker);
    }

    resetForConflict() {
        this.cardsInPlay.each(card => {
            card.resetForConflict();
        });
    }

    sacrificeCard(card) {
        this.game.applyGameAction('sacrifice', card, card => {
            this.game.raiseEvent('onSacrificed', { player: this, card: card }, () => {
                if (card.isConflict) {
                    this.moveCard(card, GameLocation.ConflictDiscardPile);
                } else if (card.isDynasty) {
                    this.moveCard(card, GameLocation.DynastyDiscardPile);
                }
            });
        });
    }

    discardCard(card, allowSave = true) {
        this.discardCards([card], allowSave);
    }

    discardCards(cards, allowSave = true, callback: { (cards): any } = () => true) {
        this.game.applyGameAction('discard', cards, cards => {
            var params = {
                player: this,
                cards: cards,
                allowSave: allowSave,
                originalLocation: cards[0].location
            };
            this.game.raiseEvent('onCardsDiscarded', params, event => {
                _.each(event.cards, card => {
                    this.doSingleCardDiscard(card, allowSave);
                });
                this.game.queueSimpleStep(() => {
                    callback(event.cards);
                });
            });
        });
    }

    doSingleCardDiscard(card, allowSave = true) {
        var params = {
            player: this,
            card: card,
            allowSave: allowSave,
            originalLocation: card.location
        };
        this.game.raiseEvent('onCardDiscarded', params, event => {
            if(event.card.isConflict) {
                this.moveCard(event.card, GameLocation.ConflictDiscardPile);
            } else if(event.card.isDynasty) {
                this.moveCard(event.card, GameLocation.DynastyDiscardPile);
            }
        });
    }

    returnCardToHand(card) {
        this.game.applyGameAction('returnToHand', card, card => {
            this.moveCard(card, GameLocation.Hand);
        });
    }

    getFavor() {
        var cardGlory = this.cardsInPlay.reduce((memo, card) => {
            if(!card.bowed && card.getType() === 'character' && card.contributesToFavor) {
                return memo + card.glory;
            }

            return memo;
        }, 0);

        this.cardsInPlay.each(card => {
            cardGlory = card.modifyFavor(this, cardGlory);
        });
        
        let rings = this.getClaimedRings();
        
        this.totalGloryForFavor = cardGlory + _.size(rings);

        return this.totalGloryForFavor;
    }

    getClaimedRings() {
        return _.filter<any>(this.game.rings, ring => ring.claimedBy === this.name);
    }
 
    claimImperialFavor(conflictType) {
        this.imperialFavor = conflictType;
    }

    loseImperialFavor() {
        this.imperialFavor = '';
    }

    readyCards(notCharacters = false) {
        this.cardsInPlay.each(card => {
            card.attachments.each(attachment => {
                this.readyCard(attachment);
            });

            if((notCharacters && card.getType() === 'character') || !card.readysDuringReadying) {
                return;
            }

            this.readyCard(card);
        });

        this.stronghold.bowed = false;
    }

    removeAttachment(attachment, parentLeftPlay = false) {

        if(attachment.isAncestral() && parentLeftPlay) {
            attachment.owner.moveCard(attachment, GameLocation.Hand);
        } else {
            attachment.owner.moveCard(attachment, GameLocation.ConflictDiscardPile);
        }
    }

    selectDeck(deck) {
        this.deck.selected = false;
        this.deck = deck;
        this.deck.selected = true;

        this.stronghold.cardData = deck.stronghold[0];
        this.faction = deck.faction;
    }

    moveCard(card, targetLocation: GameLocation, options:any = {}) {

        this.removeCardFromPile(card);

        var targetPile = this.getSourceList(targetLocation);

        if(!targetPile || targetPile.contains(card)) {
            return;
        }

        if(card.location === GameLocation.PlayArea && (card.isConflict || card.isDynasty)) {
            if(card.owner !== this) {
                card.owner.moveCard(card, targetLocation);
                return;
            }

            card.attachments.each(attachment => {
                this.removeAttachment(attachment);
            });

            /* Ignore dupe mechanic
            while(card.dupes.size() > 0 && targetLocation !== 'play area') {
                this.removeDuplicate(card, true);
            }
            */

            var params = {
                player: this,
                card: card
            };

            this.game.raiseEvent('onCardLeftPlay', params, event => {
                event.card.leavesPlay();
                
                if(event.card.parent && event.card.parent.attachments) {
                    event.card.parent.attachments = this.removeCardByUuid(event.card.parent.attachments, event.card.uuid);
                    event.card.parent = undefined;
                }
                
                card.moveTo(targetLocation);
            });
        }

        // TODO: does this even do anything?
        if(card.location === 'province') {
            card.leavesPlay();
            this.game.raiseEvent('onCardLeftPlay', { player: this, card: card });
        }

        if(card.location !== GameLocation.PlayArea) {
            card.moveTo(targetLocation);
        }

        if([GameLocation.ProvinceOne, GameLocation.ProvinceTwo, GameLocation.ProvinceThree, GameLocation.ProvinceFour, GameLocation.StrongholdProvince].includes(targetLocation)) {
            if(!card.isStronghold) {
                card.facedown = true;
            }
            if(!this.takenDynastyMulligan && card.isDynasty) {
                card.facedown = false;
            }
            targetPile.push(card);
        } else if(targetLocation === GameLocation.ConflictDeck && !options.bottom) {
            targetPile.unshift(card);
        } else if(targetLocation === GameLocation.DynastyDeck && !options.bottom) {
            targetPile.unshift(card);
        } else {
            targetPile.push(card);
        }

        if([GameLocation.DynastyDiscardPile, GameLocation.ConflictDiscardPile].includes(targetLocation)) {
            this.game.raiseEvent('onCardPlaced', { card: card, location: targetLocation });
        }
    }

    honorCard(card) {
        this.game.raiseEvent('onCardHonored', card, card.honor());
    }

    dishonorCard(card) {
        this.game.raiseEvent('onCardDishonored', card, card.dishonor());
    }
    
    bowCard(card) {
        if(card.bowed) {
            return;
        }

        this.game.applyGameAction('bow', card, card => {
            card.bowed = true;

            this.game.raiseEvent('onCardBowed', { player: this, card: card });
        });
    }

    readyCard(card) {
        if(!card.bowed) {
            return;
        }

        this.game.applyGameAction('ready', card, card => {
            card.bowed = false;

            this.game.raiseEvent('onCardStood', { player: this, card: card });
        });
    }

    removeCardFromPile(card) {
        if(card.controller !== this) {
            let oldController = card.controller;
            oldController.removeCardFromPile(card);

            oldController.allCards = _(oldController.allCards.reject(c => c === card));
            this.allCards.value<any>().push(card);
            card.controller = card.owner;

            return;
        }

        var originalLocation = card.location;
        var originalPile = this.getSourceList(originalLocation);

        if(originalPile) {
            originalPile = this.removeCardByUuid(originalPile, card.uuid);
            this.updateSourceList(originalLocation, originalPile);
        }
    }

    getTotalIncome() {
        return this.stronghold.cardData.fate;
    }

    getTotalHonor() {
        return this.honor;
    }

    setSelectedCards(cards) {
        this.promptState.setSelectedCards(cards);
    }

    clearSelectedCards() {
        this.promptState.clearSelectedCards();
    }

    setSelectableCards(cards) {
        this.promptState.setSelectableCards(cards);
    }

    clearSelectableCards() {
        this.promptState.clearSelectableCards();
    }

    getSummaryForCardList(list, activePlayer, hideWhenFaceup = false) {
        return list.map(card => {
            return card.getSummary(activePlayer, hideWhenFaceup);
        });
    }

    getCardSelectionState(card) {
        return this.promptState.getCardSelectionState(card);
    }

    currentPrompt() {
        return this.promptState.getState();
    }

    setPrompt(prompt) {
        this.promptState.setPrompt(prompt);
    }

    cancelPrompt() {
        this.promptState.cancelPrompt();
    }

    passDynasty() {
        this.passedDynasty = true;
    }

    setShowBid() {
        this.showBid = this.honorBid;
        this.game.addMessage('{0} reveals a bid of {1}', this, this.showBid);
    }
    
    playCharacterWithFate(card, fate, inConflict = false) {
        this.putIntoPlay(card);
        card.fate = fate;
        card.inConflict = inConflict;
        
        this.game.addMessage('{0} plays {1} {2}with {3} additional fate', this, card, inConflict ? 'into the conflict ' : '', fate);
    }
    
    resolveRingEffects(element) {
        if(element === '') {
            return;
        }

        let otherPlayer = this.game.getOtherPlayer(this);
       
        switch(element) {
            case 'air':
                this.game.promptWithMenu(this, this, {
                    activePrompt: {
                        promptTitle: 'Air Ring',
                        menuTitle: 'Choose an effect to resolve',
                        buttons: [
                            { text: 'Gain 2 Honor', arg: 'Gain 2 Honor', method: 'resolveAirRing' },
                            { text: 'Take 1 Honor from Opponent', arg: 'Take 1 Honor from Opponent', method: 'resolveAirRing' }
                        ]
                    },
                    waitingPromptTitle: 'Waiting for opponent to use Air Ring'
                });
                break;
            case 'earth':
                this.drawCardsToHand(1);
                if(otherPlayer) {
                    otherPlayer.discardAtRandom(1);
                }
                break;
            case 'void':
                this.game.promptForSelect(this, {
                    activePromptTitle: 'Choose character to remove a Fate from',
                    waitingPromptTitle: 'Waiting for opponent to use Void Ring',
                    cardCondition: card => {
                        return (card.location === 'play area' && card.fate > 0);
                    },
                    cardType: 'character',
                    onSelect: (player, card) => {
                        card.modifyFate(-1);
                        return true;
                    }
                });
                break;
            case 'water':
                this.game.promptForSelect(this, {
                    activePromptTitle: 'Choose character to bow or unbow',
                    waitingPromptTitle: 'Waiting for opponent to use Water Ring',
                    cardCondition: card => {
                        return ((card.fate === 0 || card.bowed) && card.location === 'play area');
                    },
                    cardType: 'character',
                    onSelect: (player, card) => {
                        if(card.bowed) {
                            this.readyCard(card);
                        } else {
                            this.bowCard(card);
                        }
                        return true;
                    }
                });
                break;
            case 'fire':
                this.game.promptWithMenu(this, this, {
                    activePrompt: {
                        promptTitle: 'Fire Ring',
                        menuTitle: 'Choose an effect to resolve',
                        buttons: [
                            { text: 'Honor a character', arg: 'honor', method: 'resolveFireRing' },
                            { text: 'Dishonor a character', arg: 'sihonor', method: 'resolveFireRing' }
                        ]
                    },
                    waitingPromptTitle: 'Waiting for opponent to use Fire Ring'
                });
                break;
        }
        this.game.addMessage('{0} resolved the {1} ring', this.name, element);        
    }
    
    resolveAirRing(player, choice) {
        if(choice === 'Gain 2 Honor') {
            this.game.addHonor(this, 2);
        } else {
            if(this.game.getOtherPlayer(this)) {
                this.game.transferHonor(this.game.getOtherPlayer(this), this, 1);
            } else {
                this.game.addHonor(this, 1);
            }
        }
        return true;
    }
    
    resolveFireRing(player, choice) {
        if(choice === 'honor') {
            this.game.promptForSelect(this, {
                activePromptTitle: 'Choose character to '.concat(choice),
                waitingPromptTitle: 'Waiting for opponent to use Fire Ring',
                cardCondition: card => !card.isHonored,
                cardType: 'character',
                onSelect: (player, card) => {
                    this.honorCard(card);
                    return true;
                }
            });
        } else {
            this.game.promptForSelect(this, {
                activePromptTitle: 'Choose character to '.concat(choice),
                waitingPromptTitle: 'Waiting for opponent to use Fire Ring',
                cardCondition: card => !card.isdishonored,
                cardType: 'character',
                onSelect: (player, card) => {
                    this.dishonorCard(card);
                    return true;
                }
            });
        }
        return true;
    }

    discardCharactersWithNoFate() {
        this.discardCards(this.filterCardsInPlay(card => card.type === 'character' && card.fate === 0));
    }

    getState(activePlayer): PlayerSummary {
        let isActivePlayer = activePlayer === this;
        let promptState = isActivePlayer ? this.promptState.getState() : {};
        let state: PlayerSummary = {
            additionalPiles: _.mapObject(this.additionalPiles, pile => ({
                title: pile.title,
                area: pile.area,
                isPrivate: pile.isPrivate,
                cards: this.getSummaryForCardList(pile.cards, activePlayer, pile.isPrivate)
            })),
            promptedActionWindows: this.promptedActionWindows,
            cardsInPlay: this.getSummaryForCardList(this.cardsInPlay, activePlayer),
            conflictDeck: this.getSummaryForCardList(this.conflictDeck, activePlayer),
            dynastyDeck: this.getSummaryForCardList(this.dynastyDeck, activePlayer),
            conflictDiscardPile: this.getSummaryForCardList(this.conflictDiscardPile, activePlayer),
            dynastyDiscardPile: this.getSummaryForCardList(this.dynastyDiscardPile, activePlayer),
            disconnected: this.disconnected,
            faction: this.faction,
            stronghold: this.stronghold.getSummary(activePlayer),
            firstPlayer: this.firstPlayer,
            fate: this.fate,
            hand: this.getSummaryForCardList(this.hand, activePlayer, true),
            id: this.id,
            imperialFavor: this.imperialFavor,
            left: this.left,
            numConflictCards: this.conflictDeck.size(),
            numDynastyCards: this.dynastyDeck.size(),
            name: this.name,
            numProvinceCards: this.provinceDeck.size(),
            provinceDeck: this.getSummaryForCardList(this.provinceDeck, activePlayer, true),
            provinces: {
                one: this.getSummaryForCardList(this.provinceOne, activePlayer, !this.takenDynastyMulligan),
                two: this.getSummaryForCardList(this.provinceTwo, activePlayer, !this.takenDynastyMulligan),
                three: this.getSummaryForCardList(this.provinceThree, activePlayer, !this.takenDynastyMulligan),
                four: this.getSummaryForCardList(this.provinceFour, activePlayer, !this.takenDynastyMulligan)
            },
            showBid: this.showBid,
            strongholdProvince: this.getSummaryForCardList(this.strongholdProvince, activePlayer),
            totalHonor: this.getTotalHonor(),
            timerSettings: this.timerSettings,
            user: _.omit(this.user, ['password', 'email'])
        };

        if(this.showConflictDeck()) {
            state.showConflictDeck = true;
            state.conflictDeck = this.getSummaryForCardList(this.conflictDeck, activePlayer);
        }

        if(this.showDynastyDeck()) {
            state.showDynastyDeck = true;
            state.dynastyDeck = this.getSummaryForCardList(this.dynastyDeck, activePlayer);
        }
        
        if(this.role) {
            state.role = this.role.getSummary(activePlayer);
        }

        return _.extend(state, promptState);
    }
}
