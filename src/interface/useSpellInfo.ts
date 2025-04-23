import { captureException } from '@sentry/react';
import makeApiUrl from 'common/makeApiUrl';
import SPELLS from 'common/SPELLS';
import { useEffect, useState } from 'react';
import Spell from 'common/SPELLS/Spell';
import { useExpansionContext } from 'interface/report/ExpansionContext';
import { getSpellId } from 'common/getSpellId';
import { maybeGetTalentOrSpell } from 'common/maybeGetTalentOrSpell';

const useSpellInfo = (spell: number | Spell | undefined) => {
  const { expansion } = useExpansionContext();
  const spellId = spell ? getSpellId(spell) : null;
  const argumentAsSpell =
    typeof spell === 'number' ? maybeGetTalentOrSpell(spell, expansion) : spell;

  const [spellData, setSpellData] = useState(argumentAsSpell);

  useEffect(() => {
    if (spellData && spellData.id !== spellId) {
      setSpellData(argumentAsSpell);
    }
  }, [spellData, spellId]);

  useEffect(() => {
    if (argumentAsSpell === undefined) {
      // we are missing the spell definition
      fetch(makeApiUrl(`spell/${spellId}`))
        .then((data) => data.json())
        .then((data) => {
          if (spellId && data) {
            SPELLS[spellId] = data;
            setSpellData(data);
          }
        })
        .catch((error) => {
          captureException(error);
          console.error(error);
        });
    }
  }, [spellId, argumentAsSpell]);

  return spellData;
};

export default useSpellInfo;
