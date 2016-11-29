/*global describe, it, beforeEach, expect,spyOn*/

const AttachmentPrompt = require('../../../server/game/gamesteps/attachmentprompt.js');
const Game = require('../../../server/game/game.js');
const Player = require('../../../server/game/player.js');
const DrawCard = require('../../../server/game/drawcard.js');

describe('the AttachmentPrompt', () => {
    var prompt;
    var game = {};
    var player;
    var otherPlayer;
    var attachment;
    var attachmentTarget;

    beforeEach(() => {
        game = new Game('1', 'Test Game');
        player = new Player('1', 'Player 1', true, game);
        player.initialise();
        otherPlayer = new Player('2', 'Player 2', false, game);
        otherPlayer.initialise();
        game.players[player.id] = player;
        game.players[otherPlayer.id] = otherPlayer;
        attachment = new DrawCard(player, {});
        attachmentTarget = new DrawCard(player, {});
        prompt = new AttachmentPrompt(game, player, attachment);

        player.cardsInPlay.push(attachmentTarget);
        spyOn(player, 'attach');
        spyOn(player, 'removeFromHand');
    });

    describe('the onCardClicked() function', () => {
        describe('when the player is not the prompted player', () => {
            it('should return false', () => {
                expect(prompt.onCardClicked(otherPlayer, attachmentTarget)).toBe(false);
            });
        });

        describe('when the player cannot attach the card', () => {
            beforeEach(() => {
                spyOn(player, 'canAttach').and.returnValue(false);
            });

            it('should return false', () => {
                expect(prompt.onCardClicked(otherPlayer, attachmentTarget)).toBe(false);
            });
        });

        describe('when the player can attach the card', () => {
            beforeEach(() => {
                spyOn(player, 'canAttach').and.returnValue(true);
            });

            describe('when attaching a setup card', () => {
                beforeEach(() => {
                    player.cardsInPlay.push(attachment);
                    player.phase = 'setup';
                });

                it('should attach the card', () => {
                    prompt.onCardClicked(player, attachmentTarget);
                    expect(player.attach).toHaveBeenCalled();
                });

                it('should remove the attachment from in play', () => {
                    prompt.onCardClicked(player, attachmentTarget);
                    expect(player.findCardInPlayByUuid(attachment.uuid)).not.toBeDefined();
                });
            });

            describe('when attaching a played card', () => {
                beforeEach(() => {
                    player.hand.push(attachment);
                });

                it('should attach the card', () => {
                    prompt.onCardClicked(player, attachmentTarget);
                    expect(player.attach).toHaveBeenCalled();
                });

                it('should remove the attachment from hand', () => {
                    prompt.onCardClicked(player, attachmentTarget);
                    expect(player.removeFromHand).toHaveBeenCalledWith(attachment.uuid);
                });
            });

            describe('when attaching a card from discard', () => {
                beforeEach(() => {
                    player.discardPile.push(attachment);
                    player.dropPending = true;
                });

                it('should attach the card', () => {
                    prompt.onCardClicked(player, attachmentTarget);
                    expect(player.attach).toHaveBeenCalled();
                });

                it('should remove the attachment from discard', () => {
                    prompt.onCardClicked(player, attachmentTarget);
                    expect(player.findCardByUuid(player.discard, attachment.uuid)).not.toBeDefined();
                });

                it('should end drop flow', () => {
                    prompt.onCardClicked(player, attachmentTarget);
                    expect(player.dropPending).toBeFalsy();
                });
            });
        });
    });
});