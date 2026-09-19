import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import OBR from '@owlbear-rodeo/sdk';
import './style.css';


// ============================================================
// OWLBEAR - STOCKAGE DES PERSONNAGES
// ============================================================

const CHARACTERS_METADATA_KEY =
  'chroniques-frontiere-v1/characters';

const ROLLS_BROADCAST_CHANNEL =
  'chroniques-frontiere-v1/rolls';


// ============================================================
// VALEURS PAR DEFAUT
// ============================================================

const defaults = {
  name: '',
  origin: '',
  profession: '',

  for: 12,
  dex: 12,
  vol: 12,

  hp: 18,
  hpmax: 18,

  armor: 0,
  xp: 0,

  abilities: '',
  notes: '',

  weapons: [
    {
      name: 'Épée',
      damage: 'd6',
      stat: 'for'
    }
  ],

  spells: [],

  inventory: Array(10).fill('')
};


// ============================================================
// NORMALISATION D'UNE FICHE
// ============================================================

function normalizeCharacter(parsed) {

  if (!parsed || typeof parsed !== 'object') {

    return {
      ...defaults,

      weapons: [
        {
          name: 'Épée',
          damage: 'd6',
          stat: 'for'
        }
      ],

      spells: [],

      inventory: Array(10).fill('')
    };

  }


  return {
    ...defaults,
    ...parsed,

    weapons:
      Array.isArray(parsed.weapons) &&
      parsed.weapons.length
        ? parsed.weapons
        : [
            {
              name: 'Épée',
              damage: 'd6',
              stat: 'for'
            }
          ],

    spells:
      Array.isArray(parsed.spells)
        ? parsed.spells
        : [],

    inventory:
      Array.isArray(parsed.inventory) &&
      parsed.inventory.length === 10
        ? parsed.inventory
        : Array(10).fill('')
  };

}


// ============================================================
// APPLICATION
// ============================================================

function App() {

  // ----------------------------------------------------------
  // PERSONNAGE
  // ----------------------------------------------------------

  const [c, setC] = useState(defaults);

  // Résultat des jets
  const [result, setResult] = useState('');

  // Indique si le chargement initial depuis Owlbear est terminé
  const [loaded, setLoaded] = useState(false);

  // ----------------------------------------------------------
  // DIFFUSION DES JETS AUX AUTRES JOUEURS
  // ----------------------------------------------------------

  const broadcastRoll = text => {

    if (!OBR.isAvailable) {
      return;
    }

    try {

      OBR.broadcast.sendMessage(
        ROLLS_BROADCAST_CHANNEL,
        {
          character:
            c.name ||
            'Personnage',

          text
        }
      );

    } catch (error) {

      console.error(
        'Erreur diffusion du jet :',
        error
      );

    }

  };




  // ==========================================================
  // CHARGEMENT INITIAL DEPUIS OWLBEAR
  // ==========================================================

  useEffect(() => {

    // Si l'application est ouverte hors Owlbear
    if (!OBR.isAvailable) {

      console.log(
        'OBR non disponible.'
      );

      setLoaded(true);

      return;
    }


    // On attend que le SDK Owlbear soit prêt
    let unsubscribeBroadcast = null;

    const unsubscribe = OBR.onReady(async () => {

      // ------------------------------------------------------
      // RECEPTION DES JETS DES AUTRES JOUEURS
      // ------------------------------------------------------

      unsubscribeBroadcast =
        OBR.broadcast.onMessage(
          ROLLS_BROADCAST_CHANNEL,
          event => {

            const data =
              event?.data;

            if (
              !data ||
              typeof data.text !== 'string'
            ) {
              return;
            }

            const character =
              data.character ||
              'Personnage';

            setResult(
              `${character}
${data.text}`
            );

          }
        );


      console.log(
        '========================================'
      );

      console.log(
        '===== CHRONIQUES - OWLBEAR READY ====='
      );

      console.log(
        '========================================'
      );


      try {

        const currentPlayerId =
          OBR.player.id;


        console.log(
          'Player ID =',
          currentPlayerId
        );


        // ------------------------------------------------------
        // LECTURE DES METADONNEES DE LA ROOM
        // ------------------------------------------------------

        const roomMetadata =
          await OBR.room.getMetadata();


        console.log(
          'Métadonnées room =',
          roomMetadata
        );


        // ------------------------------------------------------
        // RECUPERATION DES PERSONNAGES
        // ------------------------------------------------------

        const characters =
          roomMetadata[
            CHARACTERS_METADATA_KEY
          ] || {};


        // ------------------------------------------------------
        // RECUPERATION DE LA FICHE DU JOUEUR
        // ------------------------------------------------------

        const savedCharacter =
          characters[currentPlayerId];


        if (savedCharacter) {

          console.log(
            '===== FICHE TROUVÉE ====='
          );

          console.log(
            'Fiche chargée =',
            savedCharacter
          );


          setC(
            normalizeCharacter(
              savedCharacter
            )
          );

        } else {

          console.log(
            '===== NOUVELLE FICHE ====='
          );

          console.log(
            'Aucune fiche enregistrée pour ce joueur.'
          );


          setC(
            normalizeCharacter(
              defaults
            )
          );

        }


      } catch (error) {

        console.error(
          'Erreur lors du chargement de la fiche :',
          error
        );

      } finally {

        // ------------------------------------------------------
        // IMPORTANT
        // ------------------------------------------------------
        //
        // Les sauvegardes automatiques ne pourront commencer
        // qu'après ce moment.
        //

        setLoaded(true);

      }

    });


    return () => {

      unsubscribe?.();
      unsubscribeBroadcast?.();

    };

  }, []);



  // ==========================================================
  // SAUVEGARDE AUTOMATIQUE
  // ==========================================================

  useEffect(() => {

    // Pas encore chargé
    if (!loaded) {
      return;
    }


    // Pas dans Owlbear
    if (!OBR.isAvailable) {
      return;
    }


    // --------------------------------------------------------
    // DEBOUNCE
    // --------------------------------------------------------
    //
    // On attend 1 seconde après la dernière modification.
    //
    // Exemple :
    //
    // l'utilisateur écrit "Aragorn"
    //
    // A
    // Ar
    // Ara
    // Arag
    // Arago
    // Aragor
    // Aragorn
    //
    // Une seule sauvegarde sera effectuée après 1 seconde.
    //

    const timeout = setTimeout(
      async () => {

        try {

          const currentPlayerId =
            OBR.player.id;


          // --------------------------------------------------
          // RELIRE LES METADONNEES
          // --------------------------------------------------

          const roomMetadata =
            await OBR.room.getMetadata();


          const characters =
            roomMetadata[
              CHARACTERS_METADATA_KEY
            ] || {};


          // --------------------------------------------------
          // MODIFIER UNIQUEMENT LA FICHE DU JOUEUR
          // --------------------------------------------------

          characters[currentPlayerId] = c;


          // --------------------------------------------------
          // SAUVEGARDER
          // --------------------------------------------------

          await OBR.room.setMetadata({

            [CHARACTERS_METADATA_KEY]:
              characters

          });


          console.log(
            '✓ Sauvegarde automatique effectuée'
          );


        } catch (error) {

          console.error(
            'Erreur sauvegarde automatique :',
            error
          );

        }

      },

      1000
    );


    // --------------------------------------------------------
    // ANNULATION DU TIMER PRECEDENT
    // --------------------------------------------------------

    return () => {

      clearTimeout(timeout);

    };

  }, [c, loaded]);



  // ==========================================================
  // MODIFICATION D'UNE VALEUR
  // ==========================================================

  const set = (key, value) => {

    setC(prev => ({
      ...prev,
      [key]: value
    }));

  };



  // ==========================================================
  // DEGATS
  // ==========================================================

  const rollDamage = (
    damage,
    critical = false
  ) => {

    const match =
      String(damage)
        .toLowerCase()
        .match(/d(\d+)/);


    if (!match) {
      return 1;
    }


    const sides =
      Number(match[1]);


    if (critical) {
      return sides;
    }


    return (
      1 +
      Math.floor(
        Math.random() * sides
      )
    );

  };



  // ==========================================================
  // ATTAQUE
  // ==========================================================

  const attack = weapon => {

    const stat =
      weapon.stat || 'for';


    const attackRoll =
      1 +
      Math.floor(
        Math.random() * 20
      );


    const target =
      Number(c[stat]);


    const statName =
      stat.toUpperCase();


    let text =
      `⚔️ ${weapon.name || 'Arme'}\n`;


    text +=
      `Jet de ${statName} : ${attackRoll}/${target}\n`;


    // --------------------------------------------------------
    // CRITIQUE
    // --------------------------------------------------------

    if (attackRoll === 20) {

      const damage =
        rollDamage(
          weapon.damage,
          true
        );


      text +=
        `💥 CRITIQUE !\n`;


      text +=
        `Dégâts : ${damage} (maximum)`;


      setResult(text);
    broadcastRoll(text);


      if (OBR.isAvailable) {

        OBR.notification.show(
          `${c.name || 'Personnage'} : CRITIQUE ! ${damage} dégâts`
        );

      }


      return;

    }


    // --------------------------------------------------------
    // ECHEC CRITIQUE
    // --------------------------------------------------------

    if (attackRoll === 1) {

      text +=
        `💀 ÉCHEC CRITIQUE — complication !`;


      setResult(text);
    broadcastRoll(text);


      if (OBR.isAvailable) {

        OBR.notification.show(
          `${c.name || 'Personnage'} : échec critique !`
        );

      }


      return;

    }


    // --------------------------------------------------------
    // REUSSITE
    // --------------------------------------------------------

    if (attackRoll <= target) {

      const damage =
        rollDamage(
          weapon.damage
        );


      text +=
        `✅ RÉUSSITE\n`;


      text +=
        `Dégâts : ${damage}`;


      setResult(text);
    broadcastRoll(text);


      if (OBR.isAvailable) {

        OBR.notification.show(
          `${c.name || 'Personnage'} : ${weapon.name || 'Arme'} → ${damage} dégâts`
        );

      }

    }


    // --------------------------------------------------------
    // ECHEC
    // --------------------------------------------------------

    else {

      text +=
        `❌ ÉCHEC`;


      setResult(text);
    broadcastRoll(text);


      if (OBR.isAvailable) {

        OBR.notification.show(
          `${c.name || 'Personnage'} : attaque ratée`
        );

      }

    }

  };



  // ==========================================================
  // SORT
  // ==========================================================

  const castSpell = spell => {

    const attackRoll =
      1 +
      Math.floor(
        Math.random() * 20
      );


    const target =
      Number(c.vol);


    let text =
      `✨ ${spell.name || 'Sort'}\n`;


    text +=
      `Jet de VOL : ${attackRoll}/${target}\n`;


    // --------------------------------------------------------
    // CRITIQUE
    // --------------------------------------------------------

    if (attackRoll === 20) {

      const damage =
        rollDamage(
          spell.damage,
          true
        );


      text +=
        `💥 CRITIQUE !\n`;


      text +=
        `Dégâts : ${damage} (maximum)`;


      if (spell.effect) {

        text +=
          `\nEffet : ${spell.effect}`;

      }


      setResult(text);
    broadcastRoll(text);


      if (OBR.isAvailable) {

        OBR.notification.show(
          `${c.name || 'Personnage'} : CRITIQUE ! ${spell.name || 'Sort'}`
        );

      }


      return;

    }


    // --------------------------------------------------------
    // ECHEC CRITIQUE
    // --------------------------------------------------------

    if (attackRoll === 1) {

      text +=
        `💀 ÉCHEC CRITIQUE — complication !`;


      setResult(text);
    broadcastRoll(text);


      if (OBR.isAvailable) {

        OBR.notification.show(
          `${c.name || 'Personnage'} : échec critique du sort !`
        );

      }


      return;

    }


    // --------------------------------------------------------
    // REUSSITE
    // --------------------------------------------------------

    if (attackRoll <= target) {

      const damage =
        rollDamage(
          spell.damage
        );


      text +=
        `✅ RÉUSSITE\n`;


      text +=
        `Dégâts : ${damage}`;


      if (spell.effect) {

        text +=
          `\nEffet : ${spell.effect}`;

      }


      setResult(text);
    broadcastRoll(text);


      if (OBR.isAvailable) {

        OBR.notification.show(
          `${c.name || 'Personnage'} : ${spell.name || 'Sort'} → ${damage} dégâts`
        );

      }

    }


    // --------------------------------------------------------
    // ECHEC
    // --------------------------------------------------------

    else {

      text +=
        `❌ ÉCHEC`;


      setResult(text);
    broadcastRoll(text);


      if (OBR.isAvailable) {

        OBR.notification.show(
          `${c.name || 'Personnage'} : sort raté`
        );

      }

    }

  };



  // ==========================================================
  // JET DE CARACTERISTIQUE
  // ==========================================================

  const rollStat = stat => {

    const roll =
      1 +
      Math.floor(
        Math.random() * 20
      );


    const target =
      Number(c[stat]);


    let text =
      `${stat.toUpperCase()} — Normal\n`;


    text +=
      `${roll}/${target} — `;


    if (roll === 20) {

      text +=
        `CRITIQUE !`;

    }

    else if (roll === 1) {

      text +=
        `ÉCHEC CRITIQUE !`;

    }

    else if (roll <= target) {

      text +=
        `RÉUSSITE`;

    }

    else {

      text +=
        `ÉCHEC`;

    }


    setResult(text);
    broadcastRoll(text);

  };



  // ==========================================================
  // JET AVANTAGE / DESAVANTAGE
  // ==========================================================

  const rollStatAdvantage = (
    stat,
    advantage = true
  ) => {

    const roll1 =
      1 +
      Math.floor(
        Math.random() * 20
      );


    const roll2 =
      1 +
      Math.floor(
        Math.random() * 20
      );


    const roll =
      advantage
        ? Math.max(
            roll1,
            roll2
          )
        : Math.min(
            roll1,
            roll2
          );


    const target =
      Number(c[stat]);


    let text =
      `${stat.toUpperCase()} — ${
        advantage
          ? 'Avantage'
          : 'Désavantage'
      }\n`;


    text +=
      `${roll1} / ${roll2} → ${roll}/${target} — `;


    if (roll === 20) {

      text +=
        `CRITIQUE !`;

    }

    else if (roll === 1) {

      text +=
        `ÉCHEC CRITIQUE !`;

    }

    else if (roll <= target) {

      text +=
        `RÉUSSITE`;

    }

    else {

      text +=
        `ÉCHEC`;

    }


    setResult(text);
    broadcastRoll(text);

  };



  // ==========================================================
  // ARMES
  // ==========================================================

  const addWeapon = () => {

    set(
      'weapons',
      [
        ...c.weapons,
        {
          name: '',
          damage: 'd6',
          stat: 'for'
        }
      ]
    );

  };


  const removeWeapon = index => {

    set(
      'weapons',
      c.weapons.filter(
        (_, i) => i !== index
      )
    );

  };



  // ==========================================================
  // SORTS
  // ==========================================================

  const addSpell = () => {

    set(
      'spells',
      [
        ...c.spells,
        {
          name: '',
          damage: 'd6',
          effect: ''
        }
      ]
    );

  };


  const removeSpell = index => {

    set(
      'spells',
      c.spells.filter(
        (_, i) => i !== index
      )
    );

  };



  // ==========================================================
  // RESET
  // ==========================================================

  const reset = () => {

    if (
      window.confirm(
        'Réinitialiser complètement le personnage ?'
      )
    ) {

      setC({
        ...defaults,

        weapons: [
          {
            name: 'Épée',
            damage: 'd6',
            stat: 'for'
          }
        ],

        spells: [],

        inventory:
          Array(10).fill('')
      });


      setResult('');

    }

  };



  // ==========================================================
  // AFFICHAGE
  // ==========================================================

  return (

    <div className="app">

      <h1>
        Chroniques de la Frontière
      </h1>

      <div className="sub">
        Fiche personnage
      </div>



      {/* ====================================================
          PERSONNAGE
      ==================================================== */}

      <section>

        <h2>
          Personnage
        </h2>


        <label>

          Nom

          <input
            value={c.name}
            onChange={e =>
              set(
                'name',
                e.target.value
              )
            }
          />

        </label>


        <div className="two">

          <label>

            Origine

            <input
              value={c.origin}
              onChange={e =>
                set(
                  'origin',
                  e.target.value
                )
              }
            />

          </label>


          <label>

            Profession

            <input
              value={c.profession}
              onChange={e =>
                set(
                  'profession',
                  e.target.value
                )
              }
            />

          </label>

        </div>


        <label>

          XP

          <input
            type="number"
            value={c.xp}
            onChange={e =>
              set(
                'xp',
                Number(e.target.value)
              )
            }
          />

        </label>

      </section>



      {/* ====================================================
          CARACTERISTIQUES
      ==================================================== */}

      <section>

        <h2>
          Caractéristiques
        </h2>


        <div className="stats">


          {/* FOR */}

          <div className="stat">

            <strong>
              FOR
            </strong>


            <input
              type="number"
              value={c.for}
              onChange={e =>
                set(
                  'for',
                  Number(e.target.value)
                )
              }
            />


            <button
              onClick={() =>
                rollStat('for')
              }
            >
              🎲
            </button>


            <div className="row">

              <button
                onClick={() =>
                  rollStatAdvantage(
                    'for',
                    true
                  )
                }
              >
                +
              </button>


              <button
                onClick={() =>
                  rollStatAdvantage(
                    'for',
                    false
                  )
                }
              >
                -
              </button>

            </div>

          </div>



          {/* DEX */}

          <div className="stat">

            <strong>
              DEX
            </strong>


            <input
              type="number"
              value={c.dex}
              onChange={e =>
                set(
                  'dex',
                  Number(e.target.value)
                )
              }
            />


            <button
              onClick={() =>
                rollStat('dex')
              }
            >
              🎲
            </button>


            <div className="row">

              <button
                onClick={() =>
                  rollStatAdvantage(
                    'dex',
                    true
                  )
                }
              >
                +
              </button>


              <button
                onClick={() =>
                  rollStatAdvantage(
                    'dex',
                    false
                  )
                }
              >
                -
              </button>

            </div>

          </div>



          {/* VOL */}

          <div className="stat">

            <strong>
              VOL
            </strong>


            <input
              type="number"
              value={c.vol}
              onChange={e =>
                set(
                  'vol',
                  Number(e.target.value)
                )
              }
            />


            <button
              onClick={() =>
                rollStat('vol')
              }
            >
              🎲
            </button>


            <div className="row">

              <button
                onClick={() =>
                  rollStatAdvantage(
                    'vol',
                    true
                  )
                }
              >
                +
              </button>


              <button
                onClick={() =>
                  rollStatAdvantage(
                    'vol',
                    false
                  )
                }
              >
                -
              </button>

            </div>

          </div>

        </div>


        {result && (

          <div className="result">

            {result}

          </div>

        )}

      </section>



      {/* ====================================================
          COMBAT
      ==================================================== */}

      <section>

        <h2>
          Combat
        </h2>


        <h3>
          ⚔️ Armes
        </h3>


        {c.weapons.map(
          (weapon, index) => (

            <div
              className="weapon"
              key={index}
            >

              <input
                value={weapon.name}
                placeholder="Nom"
                onChange={e =>
                  set(
                    'weapons',
                    c.weapons.map(
                      (w, i) =>
                        i === index
                          ? {
                              ...w,
                              name:
                                e.target.value
                            }
                          : w
                    )
                  )
                }
              />


              <input
                value={weapon.damage}
                placeholder="d6"
                onChange={e =>
                  set(
                    'weapons',
                    c.weapons.map(
                      (w, i) =>
                        i === index
                          ? {
                              ...w,
                              damage:
                                e.target.value
                            }
                          : w
                    )
                  )
                }
              />


              <select
                value={
                  weapon.stat || 'for'
                }
                onChange={e =>
                  set(
                    'weapons',
                    c.weapons.map(
                      (w, i) =>
                        i === index
                          ? {
                              ...w,
                              stat:
                                e.target.value
                            }
                          : w
                    )
                  )
                }
              >

                <option value="for">
                  FOR
                </option>

                <option value="dex">
                  DEX
                </option>

                <option value="vol">
                  VOL
                </option>

              </select>


              <button
                onClick={() =>
                  attack(weapon)
                }
                title="Attaquer"
              >
                ⚔
              </button>


              <button
                onClick={() =>
                  removeWeapon(index)
                }
              >
                ×
              </button>

            </div>

          )
        )}


        <button
          onClick={addWeapon}
        >
          + Arme
        </button>



        {/* SORTS */}

        <h3>
          ✨ Sorts
        </h3>


        {c.spells.map(
          (spell, index) => (

            <div
              className="spell"
              key={index}
            >

              <label>

                Nom

                <input
                  value={spell.name}
                  placeholder="Nom du sort"
                  onChange={e =>
                    set(
                      'spells',
                      c.spells.map(
                        (s, i) =>
                          i === index
                            ? {
                                ...s,
                                name:
                                  e.target.value
                              }
                            : s
                      )
                    )
                  }
                />

              </label>


              <div className="two">

                <label>

                  Dégâts

                  <input
                    value={spell.damage}
                    placeholder="d6"
                    onChange={e =>
                      set(
                        'spells',
                        c.spells.map(
                          (s, i) =>
                            i === index
                              ? {
                                  ...s,
                                  damage:
                                    e.target.value
                                }
                              : s
                        )
                      )
                    }
                  />

                </label>


                <label>

                  Effet

                  <input
                    value={spell.effect}
                    placeholder="Effet"
                    onChange={e =>
                      set(
                        'spells',
                        c.spells.map(
                          (s, i) =>
                            i === index
                              ? {
                                  ...s,
                                  effect:
                                    e.target.value
                                }
                              : s
                        )
                      )
                    }
                  />

                </label>

              </div>


              <div className="row">

                <button
                  onClick={() =>
                    castSpell(spell)
                  }
                >
                  ✨ Lancer le sort
                </button>


                <button
                  onClick={() =>
                    removeSpell(index)
                  }
                >
                  Supprimer
                </button>

              </div>

            </div>

          )
        )}


        <button
          onClick={addSpell}
        >
          + Sort
        </button>

      </section>



      {/* ====================================================
          PV
      ==================================================== */}

      <section>

        <h2>
          PV
        </h2>


        <div className="two">

          <label>

            PV actuels

            <input
              type="number"
              value={c.hp}
              onChange={e =>
                set(
                  'hp',
                  Number(e.target.value)
                )
              }
            />

          </label>


          <label>

            PV maximum

            <input
              type="number"
              value={c.hpmax}
              onChange={e =>
                set(
                  'hpmax',
                  Number(e.target.value)
                )
              }
            />

          </label>

        </div>


        <div className="row">

          <button
            onClick={() =>
              set(
                'hp',
                Math.max(
                  0,
                  Number(c.hp) - 1
                )
              )
            }
          >
            −1 PV
          </button>


          <button
            onClick={() =>
              set(
                'hp',
                Math.min(
                  Number(c.hpmax),
                  Number(c.hp) + 1
                )
              )
            }
          >
            +1 PV
          </button>

        </div>

      </section>



      {/* ====================================================
          INVENTAIRE
      ==================================================== */}

      <section>

        <h2>
          Inventaire — 10 slots
        </h2>


        {c.inventory.map(
          (item, index) => (

            <div
              className="inv"
              key={index}
            >

              <input
                placeholder={
                  `${index + 1}.`
                }
                value={item}
                onChange={e =>
                  set(
                    'inventory',
                    c.inventory.map(
                      (v, i) =>
                        i === index
                          ? e.target.value
                          : v
                    )
                  )
                }
              />

            </div>

          )
        )}

      </section>



      {/* ====================================================
          CAPACITES
      ==================================================== */}

      <section>

        <h2>
          Capacités / Magie
        </h2>


        <textarea
          value={c.abilities}
          onChange={e =>
            set(
              'abilities',
              e.target.value
            )
          }
          placeholder="Capacités, dons, magie..."
        />

      </section>



      {/* ====================================================
          NOTES
      ==================================================== */}

      <section>

        <h2>
          Notes
        </h2>


        <textarea
          value={c.notes}
          onChange={e =>
            set(
              'notes',
              e.target.value
            )
          }
          placeholder="Notes..."
        />

      </section>



      {/* ====================================================
          RESET
      ==================================================== */}

      <button
        className="reset"
        onClick={reset}
      >
        Réinitialiser le personnage
      </button>

    </div>

  );

}


// ============================================================
// REACT
// ============================================================

ReactDOM.createRoot(
  document.getElementById('root')
).render(

  <React.StrictMode>
    <App />
  </React.StrictMode>

);