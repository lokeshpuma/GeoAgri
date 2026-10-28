"""
Link the 119 legacy GeoAgri crop ids to species in the global EcoCrop registry.

Why: the legacy registry uses ids like "finger_millet" and the global registry uses scientific-name
ids like "eleusine_coracana". With no link, Tier A crops never receive an envelope score, which
produced "Limited by: climatic_envelope" and "Best planting: June" on every card.

The species names below are curated by hand (one principal species per legacy crop). The script
checks each one against the global registry and writes the result and the misses; it does not guess.

    python backend/ml/training/build_legacy_crosswalk.py
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LEGACY = ROOT / "data/processed/crop_registry.json"
GLOBAL = ROOT / "data/processed/crop_registry_global.json"
OUT = ROOT / "data/processed/legacy_crosswalk.json"

SPECIES = {
 "rice":"Oryza sativa","wheat":"Triticum aestivum","maize":"Zea mays","sorghum":"Sorghum bicolor",
 "pearl_millet":"Pennisetum glaucum","finger_millet":"Eleusine coracana","barley":"Hordeum vulgare",
 "small_millets":None,"durum_wheat":"Triticum durum","chickpea":"Cicer arietinum","pigeon_pea":"Cajanus cajan",
 "green_gram":"Vigna radiata","black_gram":"Vigna mungo","lentil":"Lens culinaris","pea":"Pisum sativum",
 "cowpea":"Vigna unguiculata","moth_bean":"Vigna aconitifolia","cluster_bean":"Cyamopsis tetragonoloba",
 "fava_bean":"Vicia faba","horse_gram":"Macrotyloma uniflorum","groundnut":"Arachis hypogaea",
 "soybean":"Glycine max","mustard":"Brassica juncea","sunflower":"Helianthus annuus","sesame":"Sesamum indicum",
 "safflower":"Carthamus tinctorius","castor":"Ricinus communis","niger_seed":"Guizotia abyssinica",
 "cotton":"Gossypium hirsutum","almond":"Prunus amygdalus","olive":"Olea europaea","pistachio":"Pistacia vera",
 "walnut":"Juglans regia","sugarcane":"Saccharum officinarum","jute":"Corchorus capsularis",
 "tobacco":"Nicotiana tabacum","tea":"Camellia sinensis","coffee":"Coffea arabica","rubber":"Hevea brasiliensis",
 "arecanut":"Areca catechu","clover":"Trifolium alexandrinum","cassava":"Manihot esculenta",
 "potato":"Solanum tuberosum","onion":"Allium cepa","tomato":"Lycopersicon esculentum","eggplant":"Solanum melongena",
 "cabbage":"Brassica oleracea","cauliflower":"Brassica oleracea","okra":"Abelmoschus esculentus",
 "chilli":"Capsicum annuum","garlic":"Allium sativum","ginger":"Zingiber officinale","mango":"Mangifera indica",
 "banana":"Musa","orange":"Citrus sinensis","apple":"Malus","grapes":"Vitis vinifera","pomegranate":"Punica granatum",
 "guava":"Psidium guajava","papaya":"Carica papaya","watermelon":"Citrullus lanatus","muskmelon":"Cucumis melo",
 "coconut":"Cocos nucifera","turmeric":"Curcuma longa","coriander":"Coriandrum sativum","cumin":"Cuminum cyminum",
 "cardamom":"Elettaria cardamomum","black_pepper":"Piper nigrum","oats":"Avena sativa","rye":"Secale cereale",
 "triticale":"Triticosecale","foxtail_millet":"Setaria italica","kodo_millet":"Paspalum scrobiculatum",
 "little_millet":"Panicum sumatrense","proso_millet":"Panicum miliaceum","barnyard_millet":"Echinochloa",
 "browntop_millet":"Brachiaria ramosa","kidney_bean":"Phaseolus vulgaris","adzuki_bean":"Vigna angularis",
 "linseed":"Linum usitatissimum","oil_palm":"Elaeis guineensis","jatropha":"Jatropha curcas","camelina":"Camelina sativa",
 "carrot":"Daucus carota","radish":"Raphanus sativus","beetroot":"Beta vulgaris","bottle_gourd":"Lagenaria siceraria",
 "bitter_gourd":"Momordica charantia","cucumber":"Cucumis sativus","pumpkin":"Cucurbita","spinach":"Spinacia oleracea",
 "fenugreek":"Trigonella foenum-graecum","capsicum":"Capsicum annuum","mint":"Mentha","lemon":"Citrus limon",
 "sweet_lime":"Citrus limetta","pineapple":"Ananas comosus","litchi":"Litchi chinensis","custard_apple":"Annona squamosa",
 "sapota":"Manilkara zapota","amla":"Emblica officinalis","jackfruit":"Artocarpus heterophyllus","fig":"Ficus carica",
 "dates":"Phoenix dactylifera","mesta":"Hibiscus","cashew":"Anacardium occidentale","lucerne":"Medicago sativa",
 "napier_grass":"Pennisetum purpureum","guinea_grass":"Panicum maximum","maize_fodder":"Zea mays",
 "sorghum_fodder":"Sorghum bicolor","fennel":"Foeniculum vulgare","isabgol":"Plantago ovata","aloe_vera":"Aloe",
 "lemongrass":"Cymbopogon citratus","mentha":"Mentha","ashwagandha":"Withania somnifera","stevia":"Stevia rebaudiana",
 "basil":"Ocimum basilicum",
}

def main():
    legacy = json.loads(LEGACY.read_text())
    glob = json.loads(GLOBAL.read_text())
    by_sci = {c["scientific_name"].lower(): c for c in glob}
    mapping, missing, group = {}, [], []
    for c in legacy:
        cid = c["crop_id"]
        sci = SPECIES.get(cid, "__unset__")
        if sci == "__unset__":
            missing.append(cid); continue
        if sci is None:
            group.append(cid); continue
        hit = by_sci.get(sci.lower()) or next(
            (g for k, g in by_sci.items() if k.startswith(sci.lower() + " ") or k == sci.lower()), None)
        if hit:
            mapping[cid] = hit["crop_id"]
        else:
            missing.append(cid)
    OUT.write_text(json.dumps({"mapping": mapping, "not_in_ecocrop_registry": missing, "group_crops_no_single_species": group},
                              indent=1))
    print(f"legacy crops: {len(legacy)} | linked: {len(mapping)} | not found in registry: {len(missing)} | groups: {len(group)}")
    print("not found:", missing)

if __name__ == "__main__":
    main()
