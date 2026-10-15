
// What's for Tea? — the planner itself. Started by main.js once someone is signed in.
import { db, signOutUser } from "./firebase.js";
import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";
import { aiEnabled, aiJson } from "./ai.js";

let started=false;
export function startApp(user){
if(started)return;started=true;

const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const BASE_ING={
  turkeyMince:{n:'5% turkey mince',a:'meat',u:'g'}, chickenBreast:{n:'Chicken breast',a:'meat',u:'g'},
  chickenThigh:{n:'Chicken thighs, skinless',a:'meat',u:'g'}, sausages:{n:'Reduced-fat sausages',a:'meat',u:'x'},
  gammon:{n:'Gammon steaks',a:'meat',u:'x'}, porkSteaks:{n:'Pork loin steaks',a:'meat',u:'x'},
  ham:{n:'Sliced ham',a:'fridge',u:'slice'}, eggs:{n:'Eggs',a:'fridge',u:'x'}, milk:{n:'Semi-skimmed milk',a:'fridge',u:'ml'},
  cheese:{n:'Reduced-fat cheddar',a:'fridge',u:'g'}, greekYog:{n:'Light Greek yoghurt',a:'fridge',u:'g'},
  softCheese:{n:'Light soft cheese',a:'fridge',u:'g'},
  potatoes:{n:'Potatoes',a:'veg',u:'g',carb:1}, onion:{n:'Onions',a:'veg',u:'x'}, garlic:{n:'Garlic',a:'veg',u:'clove'},
  peppers:{n:'Peppers',a:'veg',u:'x'}, carrots:{n:'Carrots',a:'veg',u:'x'}, salad:{n:'Salad bag',a:'veg',u:'bag'},
  mushrooms:{n:'Mushrooms',a:'veg',u:'g'}, leeks:{n:'Leeks',a:'veg',u:'x'}, cauliflower:{n:'Cauliflower',a:'veg',u:'x'}, lemon:{n:'Lemons',a:'veg',u:'x'},
  frozenVeg:{n:'Frozen mixed veg',a:'frozen',u:'g'}, frozenPeas:{n:'Frozen peas',a:'frozen',u:'g'},
  frozenSpinach:{n:'Frozen spinach',a:'frozen',u:'g'}, fishFingers:{n:'Fish fingers',a:'frozen',u:'x'}, whiteFish:{n:'White fish fillets',a:'frozen',u:'x'},
  tomatoes:{n:'Chopped tomatoes',a:'tins',u:'tin'}, kidneyBeans:{n:'Kidney beans',a:'tins',u:'tin'}, chickpeas:{n:'Chickpeas',a:'tins',u:'tin'},
  bakedBeans:{n:'Reduced-sugar baked beans',a:'tins',u:'tin'}, sweetcorn:{n:'Sweetcorn',a:'tins',u:'tin'}, tuna:{n:'Tuna in spring water',a:'tins',u:'tin'},
  cornedBeef:{n:'Corned beef',a:'tins',u:'tin'}, pineapple:{n:'Pineapple chunks in juice',a:'tins',u:'tin'},
  redLentils:{n:'Red lentils',a:'tins',u:'g'}, flour:{n:'Plain flour',a:'tins',u:'g'},
  rice:{n:'Long grain rice',a:'tins',u:'g',carb:1}, pasta:{n:'Pasta',a:'tins',u:'g',carb:1}, spaghetti:{n:'Spaghetti',a:'tins',u:'g',carb:1}, noodles:{n:'Egg noodles',a:'tins',u:'g',carb:1},
  wraps:{n:'Wraps',a:'bread',u:'x',carb:1}, buns:{n:'Burger buns',a:'bread',u:'x',carb:1}, bread:{n:'Wholemeal bread',a:'bread',u:'slice',carb:1}, flatbreads:{n:'Flatbreads',a:'bread',u:'x',carb:1},
  stock:{n:'Stock cubes',a:'cup'}, gravy:{n:'Gravy granules',a:'cup'}, paprika:{n:'Paprika',a:'cup'}, cumin:{n:'Cumin',a:'cup'},
  chilli:{n:'Chilli powder',a:'cup'}, curry:{n:'Curry powder',a:'cup'}, herbs:{n:'Mixed herbs',a:'cup'}, soy:{n:'Soy sauce',a:'cup'},
  beefMince:{n:'5% beef mince',a:'meat',u:'g'}, broccoli:{n:'Broccoli',a:'veg',u:'x'}, sweetPotato:{n:'Sweet potatoes',a:'veg',u:'g',carb:1}, coconutMilk:{n:'Light coconut milk',a:'tins',u:'tin'},
  oil:{n:'Spray oil',a:'cup'}, ketchup:{n:'Ketchup',a:'cup'}, vinegar:{n:'Vinegar',a:'cup'}, cornflour:{n:'Cornflour',a:'cup'}, mustard:{n:'Mustard',a:'cup'}
};
const AISLES=[['meat','Meat'],['fridge','Fridge'],['veg','Fruit & veg'],['frozen','Freezer'],['tins','Tins, pasta & rice'],['bread','Bread']];
const AISLE_KEYS=['meat','fridge','veg','frozen','tins','bread','cup'];
const UNIT_LABEL={g:'grams',ml:'ml',x:'each',tin:'tins',slice:'slices',bag:'bags',clove:'cloves',cup:'cupboard'};
const PROTEINS=['chicken','turkey','beef','pork','fish','egg','veg'];

// Quantities are for 4 portions. kcal is a rough figure per adult portion.
const BUILTIN=[
 {id:'bolognese',name:'Spaghetti bolognese',kcal:500,mins:30,simple:1,p:'turkey',ing:[['turkeyMince',500],['tomatoes',2],['onion',1],['carrots',2],['garlic',2],['spaghetti',320],['herbs'],['stock']],steps:['Soften the chopped onion, grated carrot and garlic in a pan with spray oil.','Brown the mince, then add the tomatoes, herbs and a stock cube. Simmer for 20 minutes.','Cook the spaghetti and serve with the sauce.']},
 {id:'lentilbol',name:'Lentil and mince bolognese',kcal:450,mins:35,simple:1,p:'turkey',ing:[['turkeyMince',250],['redLentils',100],['tomatoes',2],['onion',1],['carrots',2],['garlic',2],['spaghetti',320],['herbs'],['stock']],steps:['Soften the onion, grated carrots and garlic, then brown the mince.','Add the lentils, tomatoes, herbs, a stock cube and 300 ml of water. Simmer for 25 minutes.','Serve with spaghetti. Half the mince, and nobody spots the lentils.']},
 {id:'sausagemash',name:'Sausage and mash with veg',kcal:450,mins:35,simple:1,p:'pork',ing:[['sausages',8],['potatoes',1000],['frozenPeas',300],['carrots',3],['onion',1],['gravy'],['oil']],steps:['Oven-bake the sausages at 200°C for 25 minutes, turning once.','Boil the potatoes and mash with a splash of the cooking water instead of butter.','Boil the carrots and peas. Make gravy with the granules and a sliced, softened onion.']},
 {id:'toad',name:'Toad in the hole',kcal:500,mins:45,simple:1,p:'pork',ing:[['sausages',8],['flour',100],['eggs',2],['milk',200],['onion',1],['frozenPeas',300],['gravy'],['oil']],steps:['Heat the oven to 220°C. Brown the sausages in a roasting tin with spray oil for 10 minutes.','Whisk the flour, eggs and milk into a smooth batter.','Pour the batter around the sausages and bake for 25 minutes without opening the oven. Serve with peas and onion gravy.']},
 {id:'sausagecass',name:'Sausage and bean casserole',kcal:450,mins:40,simple:1,p:'pork',ing:[['sausages',8],['kidneyBeans',1],['bakedBeans',1],['tomatoes',1],['onion',1],['carrots',2],['potatoes',800],['paprika']],steps:['Brown the sausages, then add the onion and carrots.','Add the tomatoes, both lots of beans and paprika. Simmer for 25 minutes.','Serve with mash or jacket potatoes.']},
 {id:'chickenchips',name:'Chicken, chips and peas',kcal:450,mins:40,simple:1,p:'chicken',ing:[['chickenBreast',500],['potatoes',900],['frozenPeas',300],['eggs',1],['bread',2],['paprika'],['oil']],steps:['Cut the potatoes into chips, spray with oil and bake at 220°C for 35 minutes, turning halfway.','Blitz the bread into crumbs with paprika. Dip chicken strips in beaten egg, then in the crumbs.','Bake the chicken for the last 20 minutes of the chips. Serve with peas.']},
 {id:'jacketbeans',name:'Jacket potatoes with beans and cheese',kcal:380,mins:15,simple:1,p:'veg',ing:[['potatoes',1000],['bakedBeans',2],['cheese',80],['salad',1]],steps:['Prick the potatoes and microwave for 8 to 10 minutes, or bake at 200°C for an hour.','Warm the beans.','Split the potatoes, top with beans and a little cheese, and serve with salad.']},
 {id:'jackettuna',name:'Tuna and sweetcorn jackets',kcal:400,mins:15,simple:1,p:'fish',ing:[['potatoes',1000],['tuna',2],['sweetcorn',1],['greekYog',150],['salad',1]],steps:['Microwave or bake the potatoes.','Mix the tuna and sweetcorn with the yoghurt.','Fill the potatoes and serve with salad.']},
 {id:'burgers',name:'Homemade burgers and wedges',kcal:450,mins:35,simple:1,p:'turkey',ing:[['turkeyMince',500],['onion',1],['eggs',1],['buns',4],['potatoes',800],['salad',1],['oil']],steps:['Mix the mince with finely chopped onion and the egg. Shape into 4 burgers.','Cut the potatoes into wedges, spray with oil and bake at 220°C for 30 minutes.','Grill or bake the burgers for 15 minutes, turning once. Serve in buns with salad.']},
 {id:'casserole',name:'Chicken casserole',kcal:400,mins:60,simple:1,p:'chicken',ing:[['chickenThigh',600],['carrots',3],['potatoes',800],['onion',1],['frozenPeas',200],['stock'],['herbs']],steps:['Brown the chicken thighs in a casserole pot, then add chopped onion, carrots and potatoes.','Pour over 600 ml of stock and add the herbs. Cover and cook at 180°C for 50 minutes.','Stir in the peas for the last 5 minutes.']},
 {id:'chickenmashpie',name:'Chicken and mushroom pie with a mash top',kcal:450,mins:50,simple:1,p:'chicken',ing:[['chickenThigh',500],['mushrooms',250],['onion',1],['milk',150],['potatoes',1000],['frozenPeas',200],['stock'],['cornflour']],steps:['Brown the chicken pieces with the onion and mushrooms.','Add 300 ml of stock and the milk, thicken with a little cornflour mixed with water, and add the peas.','Pour into a dish, top with mash and bake at 200°C for 20 minutes.']},
 {id:'chickencurry',name:'Mild chicken curry and rice',kcal:450,mins:35,simple:1,p:'chicken',ing:[['chickenBreast',500],['onion',1],['garlic',2],['tomatoes',1],['greekYog',150],['frozenPeas',150],['rice',300],['curry']],steps:['Soften the onion and garlic, then add the chicken pieces and curry powder and cook for 5 minutes.','Add the tomatoes and simmer for 15 minutes, adding the peas for the last 5.','Take off the heat, stir in the yoghurt and serve with rice.']},
 {id:'sweetsour',name:'Sweet and sour chicken',kcal:450,mins:25,simple:1,p:'chicken',ing:[['chickenBreast',500],['pineapple',1],['peppers',2],['onion',1],['rice',300],['soy'],['ketchup'],['vinegar'],['cornflour']],steps:['Stir-fry the chicken pieces until cooked, then add the onion and peppers.','Mix the pineapple juice with 2 tbsp each of ketchup and vinegar, a splash of soy and 1 tsp cornflour.','Add the pineapple and sauce, bubble until glossy and serve with rice.']},
 {id:'omelette',name:'Ham and cheese omelette with beans',kcal:350,mins:15,simple:1,p:'egg',ing:[['eggs',8],['ham',4],['cheese',60],['bakedBeans',2],['bread',4]],steps:['Beat the eggs with a splash of water and cook two omelettes in a non-stick pan.','Add chopped ham and cheese before folding.','Serve with warm beans and a slice of toast.']},
 {id:'beansegg',name:'Beans on toast with a poached egg',kcal:350,mins:10,simple:1,p:'egg',ing:[['bread',8],['bakedBeans',2],['eggs',4]],steps:['Warm the beans.','Poach the eggs in simmering water for 3 to 4 minutes.','Serve on toast.']},
 {id:'fishfingers',name:'Fish fingers, potatoes and peas',kcal:400,mins:25,simple:1,p:'fish',ing:[['fishFingers',16],['potatoes',800],['frozenPeas',300]],steps:['Boil the potatoes for 15 to 20 minutes.','Oven-bake the fish fingers as the pack says.','Boil the peas and serve together.']},
 {id:'fishpotatoes',name:'Lemon and herb fish with potatoes',kcal:380,mins:30,simple:1,p:'fish',ing:[['whiteFish',4],['lemon',1],['potatoes',800],['frozenVeg',400],['herbs'],['oil']],steps:['Roast the potato chunks at 200°C for 30 minutes.','Put the fish on a tray with lemon slices and herbs and bake for 15 to 20 minutes alongside.','Boil the frozen veg and serve together.']},
 {id:'fishcakes',name:'Tuna fishcakes, peas and salad',kcal:400,mins:35,simple:1,p:'fish',ing:[['tuna',2],['potatoes',700],['eggs',1],['bread',2],['frozenPeas',300],['salad',1],['oil']],steps:['Boil and mash the potatoes, then mix in the tuna and egg.','Shape into 8 cakes, coat in breadcrumbs and spray with oil.','Bake at 200°C for 20 minutes, turning once. Serve with peas and salad.']},
 {id:'cottagepie',name:'Cottage pie',kcal:450,mins:50,simple:1,p:'turkey',ing:[['turkeyMince',500],['carrots',2],['onion',1],['frozenPeas',150],['potatoes',1000],['cheese',40],['stock'],['gravy']],steps:['Boil and mash the potatoes.','Brown the mince with onion and grated carrot. Add stock, gravy granules and the peas, and simmer for 10 minutes.','Put the mince in a dish, top with mash and a little cheese, and bake at 200°C for 20 minutes.']},
 {id:'hotpot',name:'Mince and onion hotpot',kcal:450,mins:60,simple:1,p:'turkey',ing:[['turkeyMince',500],['onion',2],['carrots',2],['potatoes',900],['stock'],['gravy'],['oil']],steps:['Brown the mince with sliced onions and diced carrots. Add 400 ml of stock and the gravy granules.','Spoon into a dish and cover with thinly sliced, overlapping potatoes.','Spray with oil, cover with foil and bake at 180°C for 40 minutes, then uncover for 15 minutes to crisp.']},
 {id:'cornedbeef',name:'Corned beef hash with beans',kcal:450,mins:30,simple:1,p:'beef',ing:[['cornedBeef',1],['potatoes',800],['onion',1],['bakedBeans',2],['oil']],steps:['Dice the potatoes and boil for 8 minutes, then drain.','Fry the onion in spray oil, add the potatoes and fry until golden.','Break in the corned beef and fry until crisp at the edges. Serve with beans.']},
 {id:'chickenpasta',name:'Chicken and veg pasta',kcal:450,mins:25,simple:1,p:'chicken',ing:[['chickenBreast',400],['pasta',320],['frozenVeg',300],['tomatoes',1],['softCheese',100],['garlic',2]],steps:['Cook the pasta, adding the frozen veg for the last 4 minutes.','Fry chicken strips with garlic until cooked through, then add the tomatoes.','Stir in the soft cheese and toss with the pasta and veg.']},
 {id:'hampasta',name:'Ham and mushroom pasta',kcal:450,mins:20,simple:1,p:'pork',ing:[['pasta',320],['ham',8],['mushrooms',250],['softCheese',150],['frozenPeas',150],['garlic',2]],steps:['Cook the pasta, adding the peas for the last 3 minutes.','Fry the mushrooms and garlic, then add the ham and soft cheese with a splash of pasta water.','Toss everything together.']},
 {id:'hiddenveg',name:'Hidden veg tomato pasta',kcal:400,mins:25,simple:1,p:'veg',ing:[['pasta',320],['tomatoes',2],['carrots',2],['peppers',1],['onion',1],['garlic',2],['cheese',40],['herbs']],steps:['Soften the onion, garlic, grated carrot and chopped pepper.','Add the tomatoes and herbs, simmer for 15 minutes, then blend smooth.','Toss with the cooked pasta and a little cheese.']},
 {id:'maccheese',name:'Macaroni and cauliflower cheese',kcal:450,mins:30,simple:1,p:'veg',ing:[['pasta',280],['cauliflower',1],['milk',500],['flour',40],['cheese',100],['mustard']],steps:['Cook the pasta, adding cauliflower florets for the last 6 minutes. Drain.','Whisk the flour into the cold milk, then heat, stirring, until thick. Stir in most of the cheese and a little mustard.','Mix everything, top with the rest of the cheese and grill until golden.']},
 {id:'tunabake',name:'Tuna pasta bake',kcal:450,mins:30,simple:1,p:'fish',ing:[['pasta',320],['tuna',2],['sweetcorn',1],['tomatoes',2],['cheese',60],['onion',1]],steps:['Cook the pasta.','Soften the onion, add the tomatoes and simmer for 5 minutes. Stir in the tuna and sweetcorn.','Mix with the pasta, top with cheese and bake at 200°C for 15 minutes.']},
 {id:'traybake',name:'Chicken and potato traybake',kcal:450,mins:45,simple:1,p:'chicken',ing:[['chickenThigh',600],['potatoes',800],['carrots',3],['onion',2],['paprika'],['herbs'],['oil']],steps:['Chop the potatoes, carrots and onions. Toss with paprika, herbs and spray oil.','Lay the chicken thighs on top and roast at 200°C for 40 to 45 minutes.','Check the chicken is cooked through before serving.']},
 {id:'meatballs',name:'Turkey meatball pasta',kcal:500,mins:35,simple:1,p:'turkey',ing:[['turkeyMince',500],['eggs',1],['garlic',2],['tomatoes',2],['carrots',1],['pasta',320],['herbs']],steps:['Mix the mince with the egg, crushed garlic and herbs. Roll into small balls.','Brown them in a pan, then add the tomatoes and grated carrot. Simmer for 15 minutes.','Serve over the cooked pasta.']},
 {id:'chilli',name:'Turkey chilli with rice',kcal:450,mins:35,simple:1,p:'turkey',ing:[['turkeyMince',500],['kidneyBeans',1],['tomatoes',2],['onion',1],['peppers',2],['garlic',2],['rice',300],['chilli'],['cumin'],['paprika'],['stock']],steps:['Soften the onion, peppers and garlic. Add the mince and brown it.','Add the spices, tomatoes, beans and a stock cube. Simmer for 20 minutes.','Serve with rice. If chilli jackets are planned later in the week, make a double batch and chill half.']},
 {id:'chillijackets',name:'Chilli jacket potatoes',kcal:400,mins:15,simple:1,p:'turkey',uses:'chilli',ing:[['potatoes',1000],['greekYog',150],['cheese',40]],steps:['Reheat the saved chilli until piping hot.','Microwave or bake the potatoes.','Top with chilli, a spoon of yoghurt and a little cheese.'],note:'Leftovers night: uses the second half of the chilli you cooked earlier in the week.'},
 {id:'wrappizza',name:'Wrap pizzas',kcal:400,mins:15,simple:1,p:'pork',ing:[['wraps',4],['tomatoes',1],['cheese',80],['peppers',1],['ham',4],['salad',1]],steps:['Drain the chopped tomatoes and spread a spoonful on each wrap.','Top with sliced pepper, torn ham and cheese.','Bake at 200°C for 8 to 10 minutes until crisp.']},
 {id:'friedrice',name:'Chicken egg fried rice',kcal:400,mins:20,simple:1,p:'chicken',ing:[['rice',300],['eggs',4],['frozenVeg',300],['chickenBreast',250],['garlic',2],['soy']],steps:['Cook the rice and cool it quickly, or use rice cooked the day before and kept in the fridge.','Stir-fry the garlic, chicken strips and frozen veg until the chicken is cooked.','Add the rice and heat through. Push it aside, scramble the eggs in the pan, then mix and season with soy.']},
 {id:'fajitas',name:'Chicken fajita wraps',kcal:450,mins:25,simple:1,p:'chicken',ing:[['chickenBreast',500],['peppers',3],['onion',2],['wraps',8],['greekYog',150],['cheese',40],['paprika'],['cumin']],steps:['Slice the chicken, peppers and onions, and toss with paprika and cumin.','Fry in a hot pan for 10 to 12 minutes until the chicken is cooked.','Serve in warm wraps with yoghurt and a little cheese.']},
 {id:'gammon',name:'Gammon, potatoes and pineapple',kcal:450,mins:25,simple:1,p:'pork',ing:[['gammon',4],['potatoes',800],['pineapple',1],['frozenPeas',300]],steps:['Boil the potatoes.','Grill the gammon steaks for 4 to 5 minutes each side.','Warm the pineapple and peas and serve together.']},
 {id:'porksteaks',name:'Pork steaks, mash and veg',kcal:450,mins:30,simple:1,p:'pork',ing:[['porkSteaks',4],['potatoes',900],['carrots',3],['frozenPeas',200],['gravy']],steps:['Boil and mash the potatoes; boil the carrots and peas.','Grill the pork steaks for 5 to 6 minutes each side until cooked through.','Serve with gravy.']},
 {id:'leeksoup',name:'Leek and potato soup with bread',kcal:350,mins:35,simple:1,p:'veg',ing:[['leeks',3],['potatoes',600],['onion',1],['milk',200],['bread',4],['stock'],['oil']],steps:['Soften the sliced leeks and onion in a pan with spray oil.','Add the diced potatoes and 1 litre of stock. Simmer for 20 minutes.','Blend, stir in the milk and serve with bread.']},
 {id:'tomsoup',name:'Tomato soup and cheese toasties',kcal:450,mins:25,simple:1,p:'veg',ing:[['tomatoes',3],['onion',1],['carrots',1],['bread',8],['cheese',80],['stock']],steps:['Soften the onion and carrot, then add the tomatoes and 500 ml of stock.','Simmer for 15 minutes and blend until smooth.','Make toasties with the bread and cheese in a dry pan or under the grill.']},
 {id:'peaham',name:'Pea and ham soup with bread',kcal:350,mins:25,simple:1,p:'pork',ing:[['frozenPeas',600],['ham',8],['potatoes',300],['onion',1],['bread',4],['stock']],steps:['Soften the onion, add the diced potatoes and 1 litre of stock, and simmer for 15 minutes.','Add the peas for 5 minutes, then blend.','Stir in the chopped ham and serve with bread.']},
 {id:'chickennoodlesoup',name:'Chicken noodle soup',kcal:350,mins:25,simple:1,p:'chicken',ing:[['chickenBreast',300],['noodles',150],['carrots',2],['frozenPeas',150],['sweetcorn',1],['garlic',2],['stock'],['soy']],steps:['Simmer the chicken in 1.2 litres of stock with the garlic for 15 minutes, then lift out and shred.','Add the sliced carrots, noodles, peas and sweetcorn and cook for 5 minutes.','Return the chicken and season with soy.']},
 {id:'curry',name:'Chickpea and spinach curry',kcal:400,mins:25,simple:0,p:'veg',ing:[['chickpeas',2],['tomatoes',1],['frozenSpinach',200],['onion',1],['garlic',3],['greekYog',100],['rice',300],['curry']],steps:['Soften the onion and garlic, then stir in the curry powder.','Add the tomatoes and chickpeas and simmer for 15 minutes. Stir in the spinach to wilt.','Swirl in the yoghurt off the heat and serve with rice.']},
 {id:'shakshuka',name:'Shakshuka',kcal:350,mins:25,simple:0,p:'egg',ing:[['eggs',8],['tomatoes',2],['peppers',2],['onion',1],['garlic',2],['bread',4],['paprika'],['cumin']],steps:['Soften the onion, peppers and garlic with paprika and cumin.','Add the tomatoes and simmer for 10 minutes until thick.','Make 8 hollows, crack in the eggs, cover and cook for 6 to 8 minutes. Serve with toast.']},
 {id:'dhal',name:'Red lentil dhal',kcal:350,mins:30,simple:0,p:'veg',ing:[['redLentils',250],['tomatoes',1],['onion',1],['garlic',3],['frozenSpinach',150],['rice',250],['curry']],steps:['Soften the onion and garlic and stir in the curry powder.','Add the lentils, tomatoes and 750 ml of water. Simmer for 20 minutes, stirring often.','Stir in the spinach and serve with rice.']},
 {id:'spanishrice',name:'Spanish chicken and rice',kcal:450,mins:40,simple:0,p:'chicken',ing:[['chickenThigh',500],['rice',280],['peppers',2],['onion',1],['tomatoes',1],['frozenPeas',150],['paprika'],['stock']],steps:['Brown the chicken pieces in a large pan, then add the onion and peppers.','Stir in the rice and paprika, then the tomatoes and stock made up to 600 ml.','Cover and simmer for 20 minutes, adding the peas for the last 5.']},
 {id:'burritos',name:'Bean and rice burritos',kcal:400,mins:25,simple:0,p:'veg',ing:[['kidneyBeans',2],['rice',200],['peppers',1],['onion',1],['wraps',4],['greekYog',100],['cheese',40],['cumin'],['chilli']],steps:['Cook the rice.','Soften the onion and pepper, add the beans with cumin and chilli, and mash roughly.','Fill the wraps with rice, beans, cheese and yoghurt. Roll up and toast in a dry pan.']},
 {id:'veggiechilli',name:'Three-bean veggie chilli',kcal:400,mins:30,simple:0,p:'veg',ing:[['kidneyBeans',1],['chickpeas',1],['bakedBeans',1],['tomatoes',2],['peppers',2],['onion',1],['rice',300],['chilli'],['cumin'],['paprika']],steps:['Soften the onion and peppers with the spices.','Add the tomatoes and all the beans. Simmer for 20 minutes.','Serve with rice.']},
 {id:'quesadillas',name:'Chicken and bean quesadillas',kcal:450,mins:20,simple:0,p:'chicken',ing:[['wraps',8],['chickenBreast',250],['kidneyBeans',1],['peppers',1],['cheese',100],['salad',1],['cumin']],steps:['Cook the chicken strips with cumin, then mash the beans roughly.','Fill half of each wrap with chicken, beans, pepper and cheese, then fold.','Toast in a dry pan for 2 to 3 minutes each side. Serve with salad.']},
 {id:'kofta',name:'Turkey kofta flatbreads',kcal:450,mins:30,simple:0,p:'turkey',ing:[['turkeyMince',500],['onion',1],['garlic',2],['flatbreads',4],['greekYog',150],['salad',1],['cumin']],steps:['Mix the mince with grated onion, garlic and cumin. Shape into sausages.','Grill or bake at 200°C for 15 minutes, turning once.','Serve in warm flatbreads with salad and yoghurt.']},
 {id:'stuffedpeppers',name:'Stuffed peppers',kcal:400,mins:45,simple:0,p:'turkey',ing:[['peppers',4],['turkeyMince',400],['rice',150],['tomatoes',1],['onion',1],['cheese',40],['herbs']],steps:['Cook the rice. Brown the mince with the onion, then add the tomatoes and herbs and simmer for 10 minutes.','Mix in the rice. Halve the peppers and fill them.','Top with cheese and bake at 190°C for 25 minutes.']},
 {id:'stirfry',name:'Chicken noodle stir-fry',kcal:450,mins:20,simple:0,p:'chicken',ing:[['chickenBreast',400],['noodles',250],['frozenVeg',400],['peppers',1],['garlic',2],['soy']],steps:['Cook the noodles as the pack says.','Stir-fry chicken strips until cooked, then add the garlic, pepper and frozen veg.','Toss in the noodles and soy sauce.']},
 {id:'spanishomelette',name:'Spanish omelette and salad',kcal:350,mins:30,simple:0,p:'egg',ing:[['eggs',8],['potatoes',500],['onion',1],['peppers',1],['frozenSpinach',100],['salad',1]],steps:['Slice the potatoes thinly and boil for 8 minutes, then drain.','Soften the onion and pepper in an ovenproof pan, then add the potatoes and spinach.','Pour in the beaten eggs, cook gently for 8 minutes, then finish under the grill. Serve with salad.']},
 {id:'lasagnebake',name:'Lasagne-style pasta bake',kcal:500,mins:50,simple:1,p:'beef',ing:[['beefMince',500],['pasta',300],['tomatoes',2],['onion',1],['carrots',2],['garlic',2],['milk',400],['flour',30],['cheese',60],['herbs']],steps:['Brown the mince with the onion, grated carrot and garlic. Add the tomatoes and herbs and simmer for 15 minutes.','Cook the pasta. Whisk the flour into the cold milk, then heat, stirring, until thick.','Mix the pasta into the mince, pour the white sauce over, top with cheese and bake at 200°C for 20 minutes.']},
 {id:'bolbake',name:'Bolognese pasta bake',kcal:450,mins:25,simple:1,p:'turkey',uses:'bolognese',ing:[['pasta',320],['cheese',60]],steps:['Cook the pasta and stir it into the saved bolognese sauce.','Tip into a dish, top with the cheese and bake at 200°C for 15 to 20 minutes until bubbling and piping hot.'],note:'Leftovers night: uses the second half of the bolognese sauce you cooked earlier in the week.'},
 {id:'chickenbroccoli',name:'Creamy chicken and broccoli pasta',kcal:450,mins:25,simple:1,p:'chicken',ing:[['chickenBreast',400],['pasta',320],['broccoli',1],['softCheese',150],['garlic',2],['stock']],steps:['Cook the pasta, adding the broccoli florets for the last 4 minutes. Save a mug of the water.','Fry chicken strips with garlic until cooked through.','Stir in the soft cheese with half a stock cube and a splash of pasta water, then toss everything together.']},
 {id:'sausagepasta',name:'Sausage and pepper pasta',kcal:500,mins:30,simple:1,p:'pork',ing:[['sausages',6],['pasta',320],['peppers',2],['onion',1],['tomatoes',2],['garlic',2],['herbs']],steps:['Squeeze the sausages out of their skins and fry in small pieces until browned.','Add the sliced onion, peppers and garlic and cook for 5 minutes.','Add the tomatoes and herbs, simmer for 10 minutes and toss with the cooked pasta.']},
 {id:'korma',name:'Lighter chicken korma and rice',kcal:500,mins:30,simple:1,p:'chicken',ing:[['chickenBreast',500],['coconutMilk',1],['onion',1],['garlic',2],['frozenPeas',150],['rice',300],['curry']],steps:['Soften the onion and garlic, then add the chicken pieces and a mild curry powder and cook for 5 minutes.','Pour in the coconut milk and simmer for 15 minutes, adding the peas for the last 3.','Serve with rice.']},
 {id:'fishpie',name:'Fish pie with a mash top',kcal:450,mins:50,simple:1,p:'fish',ing:[['whiteFish',4],['milk',400],['cornflour'],['frozenPeas',200],['frozenSpinach',100],['potatoes',1000],['cheese',40]],steps:['Boil and mash the potatoes.','Heat the milk, thicken with cornflour mixed with water, then add the fish in chunks with the peas and spinach. Simmer for 5 minutes.','Pour into a dish, top with mash and cheese and bake at 200°C for 25 minutes.']},
 {id:'crumbfish',name:'Crumbed fish with sweet potato wedges',kcal:450,mins:35,simple:1,p:'fish',ing:[['whiteFish',4],['eggs',1],['bread',2],['sweetPotato',800],['frozenPeas',300],['paprika'],['oil']],steps:['Cut the sweet potatoes into wedges, spray with oil, sprinkle with paprika and bake at 220°C for 30 minutes.','Dip the fish in beaten egg, then in breadcrumbs. Bake for the last 15 to 20 minutes.','Serve with peas.']},
 {id:'eggnoodles',name:'Egg and veg fried noodles',kcal:400,mins:15,simple:1,p:'egg',ing:[['noodles',300],['eggs',4],['frozenVeg',400],['peppers',1],['garlic',2],['soy']],steps:['Cook the noodles as the pack says.','Stir-fry the garlic, pepper and frozen veg for 5 minutes.','Push to one side, scramble the eggs, then toss in the noodles and soy sauce.']},
 {id:'minestrone',name:'Minestrone soup with bread',kcal:350,mins:30,simple:1,p:'veg',ing:[['tomatoes',2],['carrots',2],['onion',1],['frozenVeg',200],['kidneyBeans',1],['pasta',100],['bread',4],['stock'],['herbs']],steps:['Soften the onion and diced carrots.','Add the tomatoes, beans, herbs and 1 litre of stock. Simmer for 10 minutes.','Add the pasta and frozen veg and cook for 10 minutes more. Serve with bread.']},
 {id:'chickenwraps',name:'Chicken Caesar-style wraps',kcal:400,mins:20,simple:1,p:'chicken',ing:[['chickenBreast',400],['wraps',4],['salad',1],['greekYog',100],['cheese',30],['garlic',1],['lemon',1]],steps:['Grill or pan-fry the chicken, then slice.','Mix the yoghurt with crushed garlic, a squeeze of lemon and finely grated cheese.','Fill the wraps with salad, chicken and the dressing.']},
 {id:'keema',name:'Beef keema with peas and rice',kcal:500,mins:30,simple:0,p:'beef',ing:[['beefMince',500],['onion',1],['garlic',3],['tomatoes',1],['frozenPeas',300],['rice',300],['curry']],steps:['Soften the onion and garlic, then brown the mince.','Stir in the curry powder, then the tomatoes. Simmer for 15 minutes.','Add the peas for the last 5 minutes and serve with rice.']},
 {id:'sweetpotcurry',name:'Sweet potato and chickpea curry',kcal:400,mins:35,simple:0,p:'veg',ing:[['sweetPotato',600],['chickpeas',1],['coconutMilk',1],['frozenSpinach',150],['onion',1],['garlic',2],['rice',250],['curry']],steps:['Soften the onion and garlic and stir in the curry powder.','Add the diced sweet potato, chickpeas, coconut milk and 200 ml of water. Simmer for 20 minutes until tender.','Stir in the spinach and serve with rice.']},
 {id:'porkstirfry',name:'Pork and broccoli noodle stir-fry',kcal:450,mins:20,simple:0,p:'pork',ing:[['porkSteaks',4],['noodles',250],['broccoli',1],['peppers',2],['garlic',2],['soy']],steps:['Cook the noodles as the pack says.','Slice the pork thinly and stir-fry until cooked, then add the garlic, broccoli and peppers for 5 minutes.','Toss in the noodles and soy sauce.']},
];

const DOW=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const DAYNAME=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const KEY='familyTeaPlanner.v1', LIBKEY='familyTeaPlanner.lib.v1';
const $=id=>document.getElementById(id);
const ICON={
 swap:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h13l-3.5-3.5"/><path d="M20 16H7l3.5 3.5"/></svg>',
 lock:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
 unlock:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 7.5-2"/></svg>',
 moon:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 14.5A7.5 7.5 0 0 1 9.5 5 7.5 7.5 0 1 0 19 14.5z"/></svg>',
 close:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
 gear:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/></svg>',
 copy:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>',
 plus:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
 spark:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4l1.8 4.7L18.5 10.5l-4.7 1.8L12 17l-1.8-4.7L5.5 10.5l4.7-1.8z"/></svg>',
 basket:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 9h14l-1.3 9.5a2 2 0 0 1-2 1.5H8.3a2 2 0 0 1-2-1.5z"/><path d="M9 9V7a3 3 0 0 1 6 0v2"/></svg>',
 camera:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.5"/></svg>',
 list:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/></svg>'
};

/* ---------- state ---------- */
function defaultWeek(){return{servings:4,simple:true,excluded:[],days:DOW.map(()=>({id:null,locked:false,skip:false})),ticks:[],have:[]}}
const ui={tab:'week',filter:'all',q:'',hist:{}};
let state=defaultWeek(), lib={meals:[],ing:{}};
let ING={}, MEALS=[], byId={};
let fresh=true;
try{const s=JSON.parse(localStorage.getItem(KEY));if(s&&Array.isArray(s.days)&&s.days.length===7){state=sanitizeWeek(s);fresh=false}}catch(e){}
try{const l=JSON.parse(localStorage.getItem(LIBKEY));if(l)lib=sanitizeLib(l)}catch(e){}

function sanitizeWeek(s){
  const w=defaultWeek();
  if(Number.isFinite(+s.servings))w.servings=Math.min(8,Math.max(1,+s.servings));
  if(typeof s.simple==='boolean')w.simple=s.simple;
  if(Array.isArray(s.excluded))w.excluded=s.excluded.filter(x=>typeof x==='string');
  if(Array.isArray(s.ticks))w.ticks=s.ticks.filter(x=>typeof x==='string');
  if(Array.isArray(s.have))w.have=s.have.filter(x=>typeof x==='string');
  if(Array.isArray(s.days)&&s.days.length===7)w.days=s.days.map(d=>({id:d&&typeof d.id==='string'?d.id:null,locked:!!(d&&d.locked),skip:!!(d&&d.skip)}));
  return w;
}
function sanitizeLib(l){
  const out={meals:[],ing:{}};
  if(l&&l.ing&&typeof l.ing==='object')Object.keys(l.ing).forEach(k=>{const v=l.ing[k];if(v&&typeof v.n==='string'&&AISLE_KEYS.includes(v.a))out.ing[k]={n:v.n,a:v.a,u:v.u||undefined}});
  if(l&&Array.isArray(l.meals))l.meals.forEach(m=>{if(m&&typeof m.id==='string'&&typeof m.name==='string'&&Array.isArray(m.ing)&&Array.isArray(m.steps))out.meals.push({id:m.id,name:m.name,kcal:+m.kcal||400,mins:+m.mins||30,simple:m.simple?1:0,p:PROTEINS.includes(m.p)?m.p:'veg',ing:m.ing.map(x=>Array.isArray(x)?x:(x&&typeof x.k==='string'?(x.q!=null?[x.k,x.q]:[x.k]):null)).filter(x=>Array.isArray(x)&&typeof x[0]==='string').map(x=>x.length>1?[x[0],+x[1]||0]:[x[0]]),steps:m.steps.map(String).slice(0,10),img:typeof m.img==='string'&&/^[A-Za-z0-9_-]{8,64}$/.test(m.img)?m.img:undefined,custom:1})});
  return out;
}
function rebuild(){
  ING=Object.assign({},BASE_ING,lib.ing);
  MEALS=BUILTIN.concat(lib.meals.map(m=>Object.assign({},m,{custom:1,ing:m.ing.filter(x=>ING[x[0]])})));
  byId={};MEALS.forEach(m=>byId[m.id]=m);
  state.days.forEach(d=>{if(d.id&&!byId[d.id])d.id=null});
}
rebuild();

/* ---------- sync (your Claude account when available, this browser otherwise) ---------- */
let remote=null, weekTimer=null, libTimer=null, weekDirty=false, libDirty=false;
function weekData(){return{servings:state.servings,simple:state.simple,excluded:state.excluded,days:state.days,ticks:state.ticks,have:state.have}}
function persistWeek(){
  try{localStorage.setItem(KEY,JSON.stringify(weekData()))}catch(e){}
  if(!remote)return;weekDirty=true;clearTimeout(weekTimer);
  weekTimer=setTimeout(async()=>{try{await setDoc(remote.week,weekData())}catch(e){syncFail(e)}weekDirty=false},700);
}
function persistLib(){
  try{localStorage.setItem(LIBKEY,JSON.stringify(lib))}catch(e){}
  if(!remote)return;libDirty=true;clearTimeout(libTimer);
  libTimer=setTimeout(async()=>{try{await setDoc(remote.lib,libForStore())}catch(e){syncFail(e)}libDirty=false},500);
}
function update(){render();persistWeek()}
/* ---------- shared data in Firebase ---------- */
let syncProblem='';
function syncFail(e){
  syncProblem=e&&e.code==='permission-denied'?'The shared plan couldn\'t be saved because the Firebase rules haven\'t been updated yet. See firestore.rules.txt in the project.':'Couldn\'t save to the shared plan. Check your connection.';
  toast(e&&e.code==='permission-denied'?'Saving is blocked by the Firebase rules':'Couldn\'t save. Check your connection.');try{renderMeals()}catch(x){}
}
// Firestore can't store arrays inside arrays, so ingredients are saved as {k,q} objects.
function libForStore(){return{meals:lib.meals.map(m=>Object.assign({},m,{custom:undefined,_newIng:undefined,ing:m.ing.map(x=>x.length>1?{k:x[0],q:+x[1]||0}:{k:x[0]})})),ing:lib.ing}}
async function connect(){
  const refs={week:doc(db,'tea','week'),lib:doc(db,'tea','library')};
  try{
    const [w,l]=await Promise.all([getDoc(refs.week),getDoc(refs.lib)]);
    remote=refs;syncProblem='';
    if(l.exists()){lib=sanitizeLib(l.data())}else persistLib();
    try{localStorage.setItem(LIBKEY,JSON.stringify(lib))}catch(e){}
    rebuild();
    if(w.exists()){state=sanitizeWeek(w.data())}else persistWeek();
    rebuild();try{localStorage.setItem(KEY,JSON.stringify(weekData()))}catch(e){}
    render();
    onSnapshot(refs.week,s=>{if(!s.exists()||s.metadata.hasPendingWrites||weekDirty)return;state=sanitizeWeek(s.data());rebuild();render()},e=>syncFail(e));
    onSnapshot(refs.lib,s=>{if(!s.exists()||s.metadata.hasPendingWrites||libDirty)return;lib=sanitizeLib(s.data());rebuild();render()},e=>syncFail(e));
  }catch(e){remote=null;syncFail(e)}
}
const sampleApi=aiEnabled?{json:(p,o)=>aiJson(p,o||{})}:null;

/* ---------- meal photos: small JPEGs kept in Firestore, one document each ---------- */
const blobToDataURL=b=>new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(String(r.result));r.onerror=()=>rej(r.error);r.readAsDataURL(b)});
const imageStore={async upload(blob){
  const small=await shrink(blob,640,0.72);const d=await blobToDataURL(small);
  const id='i'+Date.now().toString(36)+Math.random().toString(36).slice(2,8);
  await setDoc(doc(db,'teaImages',id),{d,at:Date.now()});return{id};
}};
const imgCache=new Map();
function loadImg(id){if(!imgCache.has(id))imgCache.set(id,getDoc(doc(db,'teaImages',id)).then(s=>s.exists()?s.data().d:null).catch(()=>null));return imgCache.get(id)}
function hydrateImgs(){document.querySelectorAll('img[data-img]:not([src])').forEach(el=>{loadImg(el.dataset.img).then(u=>{if(u)el.src=u;else el.remove()})})}

/* ---------- dates ---------- */
function weekStart(){const d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()+((8-d.getDay())%7));return d}
const WS=weekStart();
function dayDate(i){const d=new Date(WS);d.setDate(d.getDate()+i);return d}
const fmtDate=d=>d.toLocaleDateString('en-GB',{day:'numeric',month:'short'});

/* ---------- planning ---------- */
const freshKeys=m=>m.ing.map(x=>x[0]).filter(k=>ING[k]&&ING[k].a!=='cup');
const pool=()=>MEALS.filter(m=>!state.excluded.includes(m.id)&&(!state.simple||m.simple));
function srcBefore(i,src){for(let j=i-1;j>=0;j--){const d=state.days[j];if(!d.skip&&d.id===src)return j}return -1}
function pickFor(i,avoidList){
  const avoid=new Set(avoidList||[]);const days=state.days;
  const others=days.map((d,j)=>j!==i&&!d.skip&&d.id&&byId[d.id]?d.id:null).filter(Boolean);
  const inWeek=new Set(others);const have=new Set();const pc={};
  others.forEach(id=>{freshKeys(byId[id]).forEach(k=>have.add(k));const p=byId[id].p;pc[p]=(pc[p]||0)+1});
  const neigh=[days[i-1],days[i+1]].filter(d=>d&&!d.skip&&d.id&&byId[d.id]).map(d=>byId[d.id].p);
  const cands=pool().filter(m=>!avoid.has(m.id)&&(!m.uses||srcBefore(i,m.uses)>=0));
  let list=cands.filter(m=>!inWeek.has(m.id));if(!list.length)list=cands;if(!list.length)return null;
  let best=null,bs=-Infinity;
  list.forEach(m=>{let s=0;freshKeys(m).forEach(k=>{s+=have.has(k)?1.2:-0.7});
    if(neigh.includes(m.p))s-=2.5;if((pc[m.p]||0)>=2)s-=3;if(m.uses)s+=2.5;s+=Math.random()*3.5;
    if(s>bs){bs=s;best=m}});
  return best.id;
}
function validate(){state.days.forEach((d,i)=>{if(d.skip||d.locked||!d.id)return;const m=byId[d.id];if(m&&m.uses&&srcBefore(i,m.uses)<0)d.id=pickFor(i,[m.id])})}
function plan(){state.days.forEach(d=>{if(!d.locked&&!d.skip)d.id=null});state.days.forEach((d,i)=>{if(!d.locked&&!d.skip)d.id=pickFor(i)});validate();ui.hist={}}

/* ---------- quantities & shopping ---------- */
function fmtQty(k,q){
  const u=(ING[k]||{}).u;
  if(u==='g'||u==='ml'){const big=u==='g'?'kg':'litres';const r=q<200?Math.max(25,Math.ceil(q/25)*25):Math.ceil(q/50)*50;return r>=1000?(+(r/1000).toFixed(1))+' '+(u==='g'?'kg':'l'):r+' '+u}
  const n=Math.max(1,Math.ceil(q-0.01));
  if(u==='tin')return n+(n>1?' tins':' tin');
  if(u==='bag')return n+(n>1?' bags':' bag');
  if(u==='slice')return n+(n>1?' slices':' slice');
  if(u==='clove'){const b=Math.max(1,Math.ceil(q/10));return b+(b>1?' bulbs':' bulb')}
  return String(n);
}
function shopping(){
  const sc=state.servings/4,map={},cup=new Set();
  const add=(k,q,label)=>{if(!ING[k])return;if(ING[k].a==='cup'){cup.add(k);return}(map[k]||(map[k]={q:0,meals:[]}));map[k].q+=(+q||0)*sc;if(!map[k].meals.includes(label))map[k].meals.push(label)};
  state.days.forEach((d,i)=>{if(d.skip||!d.id||!byId[d.id])return;const m=byId[d.id];
    m.ing.forEach(([k,q])=>add(k,q,m.name));
    if(m.uses&&srcBefore(i,m.uses)>=0){const s=byId[m.uses];s.ing.forEach(([k,q])=>{if(ING[k]&&!ING[k].carb)add(k,q,s.name+' (double batch)')})}});
  const have={};state.have.forEach(k=>{if(map[k]){have[k]=map[k];delete map[k]}});
  return{map,cup,have};
}
function doubles(){const s=new Set();state.days.forEach((d,i)=>{if(d.skip||!d.id||!byId[d.id])return;const m=byId[d.id];if(m.uses){const j=srcBefore(i,m.uses);if(j>=0)s.add(j)}});return s}

/* ---------- render ---------- */
const PICON={
 chicken:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 3.5a5.5 5.5 0 0 1 4.9 7.6c-1.1 2.6-3.9 3.8-6.4 3.2l-4.2 4.2a2 2 0 1 1-2.8-2.8l4.2-4.2C10 8.8 11.2 3.8 15 3.5z"/></svg>',
 turkey:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="13" r="6.5"/><path d="M16.5 13H22"/><path d="M7.5 12.5c1-1 2.5-1 3.5 0s2.5 1 3 0"/></svg>',
 beef:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5.5 7.5c3.5-3.5 10.5-3 13.5 1s.5 10.5-4.5 11.5S3 17.5 3.5 13c.2-2 .5-4 2-5.5z"/><circle cx="14" cy="12" r="2"/></svg>',
 pork:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.2 18.8a3.2 3.2 0 0 1-1-5L13.8 5.2a3.2 3.2 0 0 1 5 1l.1.1a3.2 3.2 0 0 1-.1 4.5l-8.1 8.1a3.2 3.2 0 0 1-4.5-.1z"/><path d="M4 20l1.2-1.2M18.8 5.2L20 4"/></svg>',
 fish:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12c3.5-4.5 8-6 11.5-6 3 0 5.5 2.5 7.5 6-2 3.5-4.5 6-7.5 6-3.5 0-8-1.5-11.5-6z"/><circle cx="16" cy="11" r=".8"/></svg>',
 egg:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3c3.6 0 6.5 5.6 6.5 10.2a6.5 6.5 0 0 1-13 0C5.5 8.6 8.4 3 12 3z"/></svg>',
 veg:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19C5 10.5 10.5 5 19 5c0 8.5-5.5 14-14 14z"/><path d="M5 19l8.5-8.5"/></svg>'
};
const pcls=m=>'p-'+(PICON[m.p]?m.p:'veg');
const picon=m=>PICON[m.p]||PICON.veg;
function renderControls(){
  if($('servOut'))$('servOut').textContent=state.servings;
  if($('simpleToggle'))$('simpleToggle').checked=!!state.simple;
  const T={week:['This week',fmtDate(WS)+' to '+fmtDate(dayDate(6))+' · '+state.servings+' portions'],shop:['Shopping','Week of '+fmtDate(WS)],meals:['Meals',MEALS.length+' in your library']};
  $('pageTitle').textContent=T[ui.tab][0];$('weekLabel').textContent=T[ui.tab][1];
  let h='';
  if(ui.tab==='week')h='<button type="button" class="hbtn" data-action="settings" aria-label="Settings">'+ICON.gear+'</button>';
  else if(ui.tab==='shop')h='<button type="button" class="hbtn" data-action="copy">'+ICON.copy+'Copy</button>';
  else h=(imgLimits?'<button type="button" class="hbtn" data-action="scan">'+ICON.camera+'Import</button>':'')+(sampleApi?'<button type="button" class="hbtn" data-action="ideas">'+ICON.spark+'Ideas</button>':'')+'<button type="button" class="hbtn" data-action="addown">'+ICON.plus+'Add</button>';
  $('hacts').innerHTML=h;
  ['week','shop','meals'].forEach(t=>{$('t-'+t).setAttribute('aria-selected',ui.tab===t);$('p-'+t).hidden=ui.tab!==t});
}
function renderWeek(){
  const dbl=doubles();const cooking=state.days.filter(d=>!d.skip&&d.id&&byId[d.id]);
  const avg=cooking.length?Math.round(cooking.reduce((a,d)=>a+byId[d.id].kcal,0)/cooking.length/10)*10:0;
  const {map}=shopping();const n=Object.keys(map).length;
  const tiles=state.days.map((d,i)=>{
    const m=d.id?byId[d.id]:null;const locked=!!d.locked&&!d.skip&&!!m;const day=DOW[i]+' '+dayDate(i).getDate();
    if(d.skip)return '<button type="button" class="tile off" data-action="choose" data-i="'+i+'"><span class="tband p-off">'+ICON.moon+'</span><span class="tbody"><span class="tday">'+day+'</span><span class="tname">Night off</span><span class="tmeta">Leftovers or a takeaway</span></span></button>';
    if(!m)return '<button type="button" class="tile" data-action="choose" data-i="'+i+'"><span class="tband p-off">'+ICON.plus+'</span><span class="tbody"><span class="tday">'+day+'</span><span class="tname">Pick a meal</span><span class="tmeta">Tap to choose</span></span></button>';
    let note='';
    if(dbl.has(i))note='<span class="tnote double">Cook double</span>';
    else if(m.uses)note=srcBefore(i,m.uses)>=0?'<span class="tnote">Leftovers night</span>':'<span class="tnote warn">Needs '+esc(byId[m.uses].name.toLowerCase())+' first</span>';
    return '<button type="button" class="tile'+(locked?' locked':'')+'" data-action="recipe" data-i="'+i+'" aria-label="'+DAYNAME[i]+': '+esc(m.name)+(locked?', locked':'')+'"><span class="tband '+pcls(m)+'">'+picon(m)+mealImg(m,'tbimg')+(locked?'<span class="tlock">'+ICON.lock+'</span>':'')+'</span><span class="tbody"><span class="tday">'+day+'</span><span class="tname">'+esc(m.name)+'</span>'+note+'<span class="tmeta">'+m.kcal+' kcal · '+m.mins+' min</span></span></button>';
  });
  tiles.push('<button type="button" class="tile sum" data-action="tab" data-tab="shop"><span class="tband">'+ICON.basket+'</span><span class="tbody"><span class="tday">Shopping list</span><span class="tname">'+n+' items</span><span class="tmeta">'+cooking.length+' teas · ~'+avg+' kcal avg</span></span></button>');
  $('days').innerHTML=tiles.join('');
}
function renderShop(){
  const {map,cup,have}=shopping();
  $('shopLabel').textContent=state.ticks.length?state.ticks.filter(k=>map[k]).length+' of '+Object.keys(map).length+' ticked':'';
  let html='';
  AISLES.forEach(([a,label])=>{
    const ks=Object.keys(map).filter(k=>ING[k].a===a).sort((x,y)=>ING[x].n.localeCompare(ING[y].n));
    if(!ks.length)return;
    html+='<div class="aisle"><h3>'+label+'</h3>'+ks.map(k=>{const it=map[k];const done=state.ticks.includes(k);
      return '<label class="item'+(done?' done':'')+'"><input type="checkbox" id="tick-'+esc(k)+'" data-tick="'+esc(k)+'"'+(done?' checked':'')+'><span><span class="iname">'+esc(ING[k].n)+(it.meals.length>1?'<span class="multi">'+it.meals.length+' teas</span>':'')+'</span><span class="iused">'+esc(it.meals.join(', '))+'</span></span><span class="iqty">'+fmtQty(k,it.q)+'</span><button type="button" class="havebtn" data-action="have" data-k="'+esc(k)+'" aria-label="Already got '+esc(ING[k].n)+', take it off the list">Got it</button></label>'}).join('')+'</div>';
  });
  if(cup.size)html+='<div class="aisle"><h3>Check the cupboard</h3><div class="cupboard">'+esc([...cup].map(k=>ING[k].n).sort().join(', '))+'</div></div>';
  const hk=Object.keys(have).sort((x,y)=>ING[x].n.localeCompare(ING[y].n));
  if(hk.length)html+='<div class="aisle"><h3>Already in</h3>'+hk.map(k=>'<div class="item had"><span></span><span><span class="iname">'+esc(ING[k].n)+'</span><span class="iused">'+esc(have[k].meals.join(', '))+'</span></span><span class="iqty">'+fmtQty(k,have[k].q)+'</span><button type="button" class="havebtn" data-action="unhave" data-k="'+esc(k)+'" aria-label="Put '+esc(ING[k].n)+' back on the list">Put back</button></div>').join('')+'</div>';
  if(!Object.keys(map).length&&!hk.length)html='<p class="hint" style="margin-top:12px">No teas planned yet. Tap <b>Plan my week</b> to fill the list.</p>';
  $('shop').innerHTML=html;
}
function renderMeals(){
  document.querySelectorAll('#filters .fbtn').forEach(b=>b.setAttribute('aria-pressed',b.dataset.f===ui.filter));
  const q=ui.q.trim().toLowerCase();
  const list=MEALS.filter(m=>ui.filter==='all'||(ui.filter==='simple'?m.simple:ui.filter==='different'?!m.simple:m.custom))
    .filter(m=>!q||m.name.toLowerCase().includes(q)||m.ing.some(([k])=>ING[k]&&ING[k].n.toLowerCase().includes(q)));
  const inRot=MEALS.filter(m=>!state.excluded.includes(m.id)).length;
  $('libStats').textContent=inRot+' of '+MEALS.length+' meals in rotation. Switch off any your family won\'t eat.';
  $('lib').innerHTML=list.length?list.map(m=>{const on=!state.excluded.includes(m.id);
    return '<li class="lrow'+(on?'':' out')+'"><button type="button" class="meal" data-action="librecipe" data-id="'+esc(m.id)+'"><span class="licon '+pcls(m)+'">'+picon(m)+mealImg(m,'limg')+'</span><span class="mname">'+esc(m.name)+'</span><span class="meta">'+m.kcal+' kcal · '+m.mins+' min'+(m.uses?' · leftovers':'')+(m.custom?' · yours':'')+'</span></button>'+
      '<label class="switch"><input type="checkbox" id="rot-'+esc(m.id)+'" data-rot="'+esc(m.id)+'"'+(on?' checked':'')+'><span class="track"></span><span class="sr">Include '+esc(m.name)+' in plans</span></label></li>'}).join('')
    :'<li class="hint">No meals match. Try another search, or add one.</li>';
  $('syncNote').textContent=syncProblem||(remote?'Your plan, shopping list and library are shared with everyone signed in to What\'s for Tea?, and update live on every phone.':'Connecting to your shared plan…');
}
function render(){rebuild();renderControls();renderWeek();renderShop();renderMeals()}

/* ---------- sheets ---------- */
let lastFocus=null;
function openSheet(html){lastFocus=document.activeElement;$('panel').innerHTML=html;$('sheet').hidden=false;$('panel').scrollTop=0;const c=$('panel').querySelector('[data-action="close"]');if(c)c.focus()}
function closeSheet(){if(ideaCtrl){ideaCtrl.abort();ideaCtrl=null}if(scanCtrl){scanCtrl.abort();scanCtrl=null}$('sheet').hidden=true;if(lastFocus&&document.body.contains(lastFocus))lastFocus.focus()}
const head=t=>'<div class="ph"><h2 id="sheetTitle">'+t+'</h2><button type="button" class="ib" data-action="close" aria-label="Close">'+ICON.close+'</button></div>';
function ingListHTML(m,sc){return '<ul class="ings">'+m.ing.filter(([k])=>ING[k]).map(([k,q])=>'<li><span>'+esc(ING[k].n)+'</span><span>'+(ING[k].a==='cup'?'to taste':fmtQty(k,(+q||0)*sc))+'</span></li>').join('')+'</ul>'}
function recipeHTML(m,dayIdx){
  const sc=state.servings/4;let top='',actions='';
  if(dayIdx!=null){const d=state.days[dayIdx];
    top='<div class="sacts"><button type="button" class="sbtn" data-action="swap" data-i="'+dayIdx+'" data-close="1">'+ICON.swap+'Swap</button>'+
      '<button type="button" class="sbtn" data-action="choose" data-i="'+dayIdx+'">'+ICON.list+'Choose</button>'+
      '<button type="button" class="sbtn" data-action="lock" data-i="'+dayIdx+'" data-close="1" aria-pressed="'+!!d.locked+'">'+(d.locked?ICON.lock:ICON.unlock)+(d.locked?'Locked':'Lock')+'</button>'+
      '<button type="button" class="sbtn" data-action="skip" data-i="'+dayIdx+'" data-close="1">'+ICON.moon+'Night off</button></div>'}
  else actions='<div class="prow"><select id="putDay" aria-label="Day">'+DAYNAME.map((n,i)=>'<option value="'+i+'">'+n+'</option>').join('')+'</select><button type="button" class="btn btn-primary" data-action="put" data-id="'+esc(m.id)+'">Put it on this day</button></div>';
  if(m.custom)actions+='<div class="prow"><button type="button" class="btn" data-action="edit" data-id="'+esc(m.id)+'">Edit meal</button><button type="button" class="btn btn-danger" id="delBtn" data-action="delete" data-id="'+esc(m.id)+'">Delete meal</button></div>';
  return '<div class="sband '+pcls(m)+(m.img?' has-img':'')+'">'+picon(m)+mealImg(m,'sbimg')+'</div>'+head(esc(m.name))+'<p class="meta" style="margin:-10px 0 0">'+(dayIdx!=null?DAYNAME[dayIdx]+' · ':'')+m.kcal+' kcal · '+m.mins+' min · serves '+state.servings+'</p>'+top+
   (m.note?'<p class="note">'+esc(m.note)+'</p>':'')+
   '<div><h4>Ingredients</h4>'+ingListHTML(m,sc)+'</div>'+
   '<div><h4>Method</h4><ol class="steps">'+m.steps.map(s=>'<li>'+esc(s)+'</li>').join('')+'</ol></div>'+actions;
}
function chooseHTML(i){
  const d=state.days[i];const avail=MEALS.filter(m=>!state.excluded.includes(m.id)).sort((a,b)=>a.name.localeCompare(b.name));
  const grp=(t,arr)=>arr.length?'<div><h4>'+t+'</h4><div class="pick">'+arr.map(m=>'<button type="button" data-action="set" data-i="'+i+'" data-id="'+esc(m.id)+'"><span>'+esc(m.name)+'</span><span class="meta">'+m.kcal+' kcal</span></button>').join('')+'</div></div>':'';
  return head('Choose '+DAYNAME[i]+'\'s tea')+
   (d.skip?'':'<div class="pick"><button type="button" data-action="skip" data-i="'+i+'" data-close="1"><span>Night off</span><span class="meta">Leftovers or a takeaway</span></button></div>')+
   grp('Familiar',avail.filter(m=>m.simple))+grp('A bit different',avail.filter(m=>!m.simple));
}
function settingsHTML(){
  return head('Settings')+'<div class="setlist"><div class="setrow"><span>Portions per tea</span><div class="stepper"><button type="button" id="servMinus" data-action="serv" data-d="-1" aria-label="Fewer portions">−</button><output id="servOut" aria-live="polite">'+state.servings+'</output><button type="button" id="servPlus" data-action="serv" data-d="1" aria-label="More portions">+</button></div></div>'+
   '<label class="setrow switch" for="simpleToggle"><span>Keep it familiar<small>Only plan everyday British meals</small></span><input type="checkbox" id="simpleToggle"'+(state.simple?' checked':'')+'><span class="track"></span></label>'+
   '<div class="setrow"><span>Signed in<small>'+esc(user.displayName||user.email||'')+'</small></span><button type="button" class="btn" data-action="signout">Sign out</button></div></div>';
}

/* ---------- ideas from Claude ---------- */
const QUICK=['Cheap mince dinners','Meat-free nights','15-minute teas','Kids\' favourites','Soups and stews for colder nights','Slow cooker meals','Fakeaway nights','Using up leftover chicken'];
let ideas=[], ideaCtrl=null;
function ideasHTML(){
  return head('Get meal ideas')+
   '<p class="hint">Claude suggests budget teas built from ingredients you already buy. Tick the ones you like and they join your library.</p>'+
   '<div class="qchips">'+QUICK.map(q=>'<button type="button" class="fbtn" data-action="idea-q" data-q="'+esc(q)+'">'+esc(q)+'</button>').join('')+'</div>'+
   '<label class="field" for="ideaReq">What do you fancy?<textarea id="ideaReq" rows="2" placeholder="e.g. hearty winter meals the kids will eat"></textarea></label>'+
   '<div class="prow"><label class="field" for="ideaN" style="flex-direction:row;align-items:center;gap:8px">How many<select id="ideaN"><option>3</option><option selected>5</option><option>8</option></select></label>'+
   '<label class="switch"><input type="checkbox" id="ideaSimple"'+(state.simple?' checked':'')+'><span class="track"></span>Familiar only</label>'+
   '<button type="button" class="btn btn-primary" id="ideaGo" data-action="idea-go">Suggest meals</button></div>'+
   '<p class="status" id="ideaStatus" aria-live="polite"></p><div id="ideaOut" class="pick"></div>';
}
function ingCatalogue(){return Object.keys(ING).map(k=>k+': '+ING[k].n+(ING[k].a==='cup'?' (cupboard, no qty)':' ('+UNIT_LABEL[ING[k].u]+')')).join('\n')}
function buildPrompt(req,n,simpleOnly){
  return 'You suggest evening meals ("tea") for a UK family of four on a tight budget who shop at Aldi. Every meal should be low calorie (about 350 to 550 kcal per adult portion), quick and easy, and use everyday cupboard staples and ingredients that get reused across a week.\n\n'+
  'What they asked for: '+(req||'a good mix of everyday family meals')+'\n'+
  (simpleOnly?'Keep every meal familiar British family food. Nothing adventurous.\n':'A mix of familiar and slightly more adventurous meals is fine.\n')+
  'Do not suggest any of these, which they already have: '+MEALS.map(m=>m.name).join('; ')+'\n\n'+
  'Use these ingredient keys wherever they fit. The unit in brackets is the unit for the quantity:\n'+ingCatalogue()+'\n\n'+
  'Return JSON only: an array of exactly '+n+' meals. Each meal is an object:\n'+
  '{"name": short meal name, "kcal": number per adult portion, "mins": total minutes, "simple": true if familiar or false if a bit different, "p": main protein, one of '+PROTEINS.join('|')+', '+
  '"ing": ingredients for 4 portions, each either ["key", quantity] using a key from the list (cupboard keys as ["key"] with no quantity) or, only when nothing in the list fits, {"n": ingredient name, "a": one of meat|fridge|veg|frozen|tins|bread|cup, "u": one of g|ml|x|tin|slice|bag|clove, "q": quantity}, '+
  '"steps": 3 or 4 short, plain method steps}';
}
function normIdea(raw,newIng){
  if(!raw||typeof raw.name!=='string'||!Array.isArray(raw.ing)||!Array.isArray(raw.steps))return null;
  const nameIdx={};Object.keys(ING).forEach(k=>nameIdx[ING[k].n.toLowerCase()]=k);Object.keys(newIng).forEach(k=>nameIdx[newIng[k].n.toLowerCase()]=k);
  const ing=[];
  raw.ing.forEach(x=>{
    if(Array.isArray(x)&&ING[x[0]]){ing.push(ING[x[0]].a==='cup'?[x[0]]:[x[0],Math.max(0,+x[1]||1)]);return}
    if(x&&typeof x==='object'&&!Array.isArray(x)&&typeof x.n==='string'&&x.n.trim()){
      const nm=x.n.trim().slice(0,60);let k=nameIdx[nm.toLowerCase()];
      if(!k){const a=AISLE_KEYS.includes(x.a)?x.a:'veg';const u=['g','ml','x','tin','slice','bag','clove'].includes(x.u)?x.u:'x';
        k='x_'+nm.toLowerCase().replace(/[^a-z0-9]+/g,'').slice(0,24)+'_'+Math.random().toString(36).slice(2,6);
        newIng[k]=a==='cup'?{n:nm,a:'cup'}:{n:nm,a,u};nameIdx[nm.toLowerCase()]=k}
      const def=ING[k]||newIng[k];ing.push(def.a==='cup'?[k]:[k,Math.max(0,+x.q||1)])}
  });
  if(!ing.length)return null;
  return{id:'c_'+raw.name.toLowerCase().replace(/[^a-z0-9]+/g,'').slice(0,20)+'_'+Date.now().toString(36)+Math.random().toString(36).slice(2,5),
    name:raw.name.trim().slice(0,80),kcal:Math.min(900,Math.max(150,Math.round(+raw.kcal||400))),mins:Math.min(240,Math.max(5,Math.round(+raw.mins||30))),
    simple:raw.simple===false?0:1,p:PROTEINS.includes(raw.p)?raw.p:'veg',ing,steps:raw.steps.map(s=>String(s).slice(0,300)).filter(Boolean).slice(0,6)};
}
let ideaNewIng={};
async function runIdeas(){
  if(!sampleApi)return;
  const req=$('ideaReq').value.trim(),n=+$('ideaN').value||5,simpleOnly=$('ideaSimple').checked;
  const go=$('ideaGo'),st=$('ideaStatus');go.disabled=true;st.textContent='Thinking up ideas…';$('ideaOut').innerHTML='';
  if(ideaCtrl)ideaCtrl.abort();ideaCtrl=new AbortController();
  try{
    const r=await sampleApi.json(buildPrompt(req,n,simpleOnly),{modelTier:'default',signal:ideaCtrl.signal,cache:false});
    const arr=Array.isArray(r)?r:(r&&Array.isArray(r.meals)?r.meals:[]);
    ideaNewIng={};ideas=arr.map(x=>normIdea(x,ideaNewIng)).filter(Boolean);
    if(!ideas.length){st.textContent='No usable ideas came back. Try again or reword your request.';return}
    st.textContent='Tick the ones you want, then add them.';
    const nm=k=>(ING[k]||ideaNewIng[k]||{}).n;
    $('ideaOut').innerHTML=ideas.map((m,j)=>'<label class="idea"><input type="checkbox" id="idea-'+j+'" data-idea="'+j+'" checked><span><span class="mname">'+esc(m.name)+'</span><span class="meta" style="display:block">'+m.kcal+' kcal · '+m.mins+' min'+(m.simple?'':' · a bit different')+'</span><span class="iused">'+esc(m.ing.map(([k])=>nm(k)).filter(Boolean).join(', '))+'</span></span></label>').join('')+
      '<div class="prow" style="margin-top:6px"><button type="button" class="btn btn-primary" data-action="idea-add">Add ticked meals</button><button type="button" class="btn" data-action="idea-go">Try again</button></div>';
  }catch(e){
    const c=e&&e.code;
    st.textContent=c==='cancelled'?'':c==='not_granted'?'The Claude features aren\'t set up yet. You can still add meals by hand.':c==='rate_limited'?'Too many requests just now. Try again in a minute.':'Couldn\'t get ideas this time. Try again.';
  }finally{go.disabled=false;ideaCtrl=null}
}
function addIdeas(){
  const picked=ideas.filter((m,j)=>{const cb=$('idea-'+j);return cb&&cb.checked});
  if(!picked.length){$('ideaStatus').textContent='Tick at least one meal to add.';return}
  picked.forEach(m=>{m.ing.forEach(([k])=>{if(ideaNewIng[k])lib.ing[k]=ideaNewIng[k]});lib.meals.push(m)});
  persistLib();render();closeSheet();toast(picked.length+(picked.length>1?' meals':' meal')+' added to your library');
}

/* ---------- import a recipe from photos (card or screenshots) ---------- */
let imgLimits=aiEnabled?{maxCount:6,mediaTypes:['image/jpeg']}:null, assetsApi=imageStore, scanCtrl=null, scanDraftPhoto=null, fromScan=false, scanMsg='';
let scan={mode:'card',front:null,back:null,keep:null,shots:[]};
const resetScan=()=>{scan={mode:scan.mode||'card',front:null,back:null,keep:null,shots:[]}};
const maxShots=()=>Math.max(1,Math.min(6,imgLimits?imgLimits.maxCount:4));
const mealImg=(m,cls)=>m.img?'<img class="'+cls+'" data-img="'+esc(m.img)+'" alt="">':'';
function shrink(file,max,q){return new Promise((res,rej)=>{const url=URL.createObjectURL(file);const img=new Image();
  img.onload=()=>{const s=Math.min(1,max/Math.max(img.width,img.height));const c=document.createElement('canvas');c.width=Math.round(img.width*s);c.height=Math.round(img.height*s);
    const g=c.getContext('2d');g.fillStyle='#FFFFFF';g.fillRect(0,0,c.width,c.height);g.drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(url);c.toBlob(b=>b?res(b):rej(new Error('encode')),'image/jpeg',q)};
  img.onerror=()=>{URL.revokeObjectURL(url);rej(new Error('load'))};img.src=url})}
function shotSlot(k,label,desc){
  const has=scan[k];
  return '<label class="shot" for="shot-'+k+'"><input type="file" accept="image/*" id="shot-'+k+'" data-shot="'+k+'" class="sr">'+
   '<span class="shotin">'+(has?'<img src="'+URL.createObjectURL(has)+'" alt="'+label+' of the card">':ICON.camera+'<b>'+label+'</b><small>'+desc+'</small>')+'</span></label>';
}
function scanHTML(){
  const card=scan.mode==='card';let body;
  if(card){
    body='<p class="hint">Take or choose a photo of each side of the card.</p>'+
     '<div class="shots">'+shotSlot('front','Front','Photo and name side')+shotSlot('back','Back','Ingredients and method')+'</div>';
  }else{
    const n=maxShots();
    body='<p class="hint">Screenshot a recipe from a website or app, then add the screenshots here in order. Up to '+n+'. On a computer you can also paste them in.</p>'+
     '<div class="shotgrid">'+scan.shots.map((b,j)=>'<div class="thumb"><img src="'+URL.createObjectURL(b)+'" alt="Screenshot '+(j+1)+'"><button type="button" class="ib" data-action="shot-del" data-j="'+j+'" aria-label="Remove screenshot '+(j+1)+'">'+ICON.close+'</button></div>').join('')+
     (scan.shots.length<n?'<label class="shot" for="shot-shots"><input type="file" accept="image/*" multiple id="shot-shots" data-shot="shots" class="sr"><span class="shotin">'+ICON.plus+'<b>'+(scan.shots.length?'Add more':'Add screenshots')+'</b><small>From your photos</small></span></label>':'')+'</div>'+
     (scan.shots.length?'<label class="switch"><input type="checkbox" id="shotKeep"'+(scan.keepFirst===false?'':' checked')+'><span class="track"></span>Use the first screenshot as the meal\'s photo</label>':'');
  }
  return head('Import a recipe')+
   (scanMsg?'<p class="note">'+esc(scanMsg)+'</p>':'')+
   '<div class="seg2" role="group" aria-label="What are you importing"><button type="button" class="fbtn" data-action="scan-mode" data-m="card" aria-pressed="'+card+'">Recipe card</button><button type="button" class="fbtn" data-action="scan-mode" data-m="shots" aria-pressed="'+!card+'">Screenshots</button></div>'+
   body+
   '<p class="hint">Claude reads it, converts it to four portions and everyday Aldi ingredients, and you check it before it\'s saved.</p>'+
   '<p class="status" id="scanStatus" aria-live="polite"></p>'+
   '<button type="button" class="btn btn-primary btn-block" id="scanGo" data-action="scan-go">Read the recipe</button>';
}
function refreshScan(){if(!$('sheet').hidden&&$('scanGo'))$('panel').innerHTML=scanHTML()}
function scanPrompt(kind,count){
  const intro=kind==='card'
    ?'The '+(count===2?'two images are photos of the front and back':'image is a photo')+' of a meal-kit recipe card (for example HelloFresh).'
    :'The '+(count>1?count+' images are screenshots, in order, of':'image is a screenshot of')+' a recipe from a website or app. Ignore adverts, comments and anything that is not the recipe itself.';
  return intro+' Read the recipe and turn it into a meal for a UK family of four who shop at Aldi.\n\n'+
  '- Scale every ingredient to 4 portions. If amounts are given for several portion sizes, use the 4-person amounts.\n'+
  '- Replace meal-kit-only or specialist items (spice blend sachets, stock pastes, branded sauces) with everyday Aldi equivalents, using cupboard keys where they fit. A spice blend becomes the 2 or 3 ordinary spices it is mostly made of.\n'+
  '- kcal is per portion as printed. If it is not shown, estimate it.\n'+
  '- Write the method in your own words as 3 to 6 short, plain steps.\n'+
  '- If you cannot read the recipe well enough, return {"unreadable": true}.\n\n'+
  'Use these ingredient keys wherever they fit. The unit in brackets is the unit for the quantity:\n'+ingCatalogue()+'\n\n'+
  'Return JSON only, one object: {"name": the meal name, "kcal": number, "mins": total minutes, "simple": true if it is familiar British family food or false if it is a bit more adventurous, "p": main protein, one of '+PROTEINS.join('|')+', '+
  '"ing": ingredients for 4 portions, each either ["key", quantity] using a key from the list (cupboard keys as ["key"] with no quantity) or, only when nothing in the list fits, {"n": ingredient name, "a": one of meat|fridge|veg|frozen|tins|bread|cup, "u": one of g|ml|x|tin|slice|bag|clove, "q": quantity}, "steps": [short method steps]}';
}
async function addShots(files){
  const st=$('scanStatus');const room=maxShots()-scan.shots.length;const list=[...files].filter(f=>f&&f.type&&f.type.startsWith('image/')).slice(0,Math.max(0,room));
  if(!list.length){if(st&&room<=0)st.textContent='That\'s the most screenshots for one recipe.';return}
  try{for(const f of list)scan.shots.push(await shrink(f,2000,0.85));refreshScan();
    if(files.length>list.length&&$('scanStatus'))$('scanStatus').textContent='Only the first '+maxShots()+' screenshots were added.'}
  catch(e){refreshScan();if($('scanStatus'))$('scanStatus').textContent='Couldn\'t open one of those images. Try a PNG or JPEG.'}
}
async function onShot(input){
  const k=input.dataset.shot,files=input.files;if(!files||!files.length)return;
  if(k==='shots'){addShots(files);return}
  try{scan[k]=await shrink(files[0],1600,0.85);if(k==='front')scan.keep=await shrink(files[0],900,0.8);refreshScan()}
  catch(e){if($('scanStatus'))$('scanStatus').textContent='Couldn\'t open that photo. Try taking it again.'}
}
async function runScan(){
  const st=$('scanStatus'),go=$('scanGo');let imgs,kind=scan.mode,keep=null;
  if(kind==='card'){
    if(!scan.back){st.textContent=scan.front?'Add the back of the card too, so Claude can read the ingredients.':'Add photos of the card first.';return}
    imgs=[scan.front,scan.back].filter(Boolean);keep=scan.keep;
  }else{
    if(!scan.shots.length){st.textContent='Add at least one screenshot first.';return}
    imgs=scan.shots.slice();const kp=$('shotKeep');if(!kp||kp.checked){try{keep=await shrink(imgs[0],900,0.8)}catch(e){keep=null}}
  }
  go.disabled=true;st.textContent='Reading the recipe. This can take up to a minute…';
  if(scanCtrl)scanCtrl.abort();scanCtrl=new AbortController();
  try{
    const r=await sampleApi.json(scanPrompt(kind,imgs.length),{images:imgs,modelTier:'default',signal:scanCtrl.signal,cache:false});
    if(!r||r.unreadable){st.textContent=kind==='card'?'Claude couldn\'t read the card clearly. Try photos in better light, flat and filling the frame.':'Claude couldn\'t find a full recipe in those screenshots. Make sure the ingredients and method are included.';return}
    const pend={};const m=normIdea(r,pend);
    if(!m){st.textContent='Claude couldn\'t pull a recipe from those images. Try again.';return}
    delete m.id;m._newIng=pend;scanDraftPhoto=keep;fromScan=true;scanMsg='';resetScan();
    openSheet(formHTML(m));
  }catch(e){
    const c=e&&e.code;
    st.textContent=c==='cancelled'?'':c==='not_granted'?'The Claude features aren\'t set up yet. You can still add meals by hand.':c==='rate_limited'?'Too many requests just now. Try again in a minute.':c==='image_rejected'?'One of the images couldn\'t be used. Try another.':'Couldn\'t read the recipe this time. Try again.';
  }finally{if(go&&document.body.contains(go))go.disabled=false;scanCtrl=null}
}
document.addEventListener('paste',e=>{
  if($('sheet').hidden||!$('scanGo'))return;const files=e.clipboardData&&e.clipboardData.files;if(!files||!files.length)return;
  e.preventDefault();if(scan.mode!=='shots'){scan.mode='shots'}addShots(files);
});

/* ---------- add / edit your own ---------- */
let editingId=null;
const unitOpts=sel=>Object.keys(UNIT_LABEL).map(u=>'<option value="'+u+'"'+(u===sel?' selected':'')+'>'+UNIT_LABEL[u]+'</option>').join('');
const aisleOpts=sel=>AISLES.concat([['cup','Cupboard']]).map(([a,l])=>'<option value="'+a+'"'+(a===sel?' selected':'')+'>'+l+'</option>').join('');
let rowSeq=0;
function rowHTML(name,q,u,a){const r=rowSeq++;
  return '<div class="frow" data-row="'+r+'"><input type="text" class="fi-n" id="fn-'+r+'" list="ingList" placeholder="Ingredient, e.g. Chopped tomatoes" value="'+esc(name||'')+'" aria-label="Ingredient">'+
   '<input type="number" class="fi-q" id="fq-'+r+'" min="0" step="any" placeholder="Qty" value="'+(q!=null&&q!==''?esc(q):'')+'" aria-label="Quantity for 4">'+
   '<select class="fi-u" id="fu-'+r+'" aria-label="Unit">'+unitOpts(u||'x')+'</select>'+
   '<select class="fi-a" id="fa-'+r+'" aria-label="Aisle">'+aisleOpts(a||'veg')+'</select>'+
   '<button type="button" class="ib" data-action="f-delrow" aria-label="Remove ingredient">'+ICON.close+'</button></div>';
}
function formHTML(m){
  editingId=m&&m.id?m.id:null;if(!m||m.id){fromScan=false;scanDraftPhoto=null}const pend=(m&&m._newIng)||{};
  const rows=m?m.ing.filter(([k])=>ING[k]||pend[k]).map(([k,q])=>{const d=ING[k]||pend[k];return rowHTML(d.n,d.a==='cup'?'':q,d.a==='cup'?'cup':d.u,d.a)}).join(''):rowHTML()+rowHTML()+rowHTML();
  return head(editingId?'Edit meal':fromScan?'Check the scanned meal':'Add your own meal')+(fromScan?'<p class="note">Claude read this from your card. Check the amounts and steps, then save.</p>'+(scanDraftPhoto?'<img src="'+URL.createObjectURL(scanDraftPhoto)+'" alt="Front of the card" style="width:100%;max-height:180px;object-fit:cover;border-radius:14px">':''):'')+
   '<label class="field" for="fName">Meal name<input type="text" id="fName" value="'+esc(m?m.name:'')+'" placeholder="e.g. Nan\'s corned beef pie"></label>'+
   '<div class="grid3"><label class="field" for="fKcal">kcal per adult<input type="number" id="fKcal" min="100" max="1200" value="'+(m?m.kcal:'')+'" placeholder="450"></label>'+
   '<label class="field" for="fMins">Minutes<input type="number" id="fMins" min="5" max="300" value="'+(m?m.mins:'')+'" placeholder="30"></label>'+
   '<label class="field" for="fP">Main<select id="fP">'+PROTEINS.map(p=>'<option'+(m&&m.p===p?' selected':'')+'>'+p+'</option>').join('')+'</select></label></div>'+
   '<label class="switch"><input type="checkbox" id="fSimple"'+(!m||m.simple?' checked':'')+'><span class="track"></span>Familiar (shows when "Keep it familiar" is on)</label>'+
   '<div><h4>Ingredients for 4 portions</h4><p class="hint" style="margin-bottom:8px">Pick from the list so it joins up with your shopping list. Spices and sauces can be "cupboard".</p><div id="fIngs" style="display:flex;flex-direction:column;gap:6px">'+rows+'</div>'+
   '<button type="button" class="btn" style="margin-top:8px" data-action="f-addrow">Add ingredient</button></div>'+
   '<label class="field" for="fSteps">Method, one step per line<textarea id="fSteps" rows="5">'+esc(m?m.steps.join('\n'):'')+'</textarea></label>'+
   '<p class="err" id="fErr" aria-live="polite"></p><div class="prow"><button type="button" class="btn btn-primary" data-action="f-save">Save meal</button></div>'+
   '<datalist id="ingList">'+Object.keys(ING).map(k=>'<option value="'+esc(ING[k].n)+'"></option>').join('')+'</datalist>';
}
function findIngKey(name){const l=name.trim().toLowerCase();return Object.keys(ING).find(k=>ING[k].n.toLowerCase()===l)}
async function saveForm(){
  const err=$('fErr');const name=$('fName').value.trim();
  if(!name){err.textContent='Give the meal a name.';$('fName').focus();return}
  const ing=[],newIng={};
  document.querySelectorAll('#fIngs .frow').forEach(r=>{
    const n=r.querySelector('.fi-n').value.trim();if(!n)return;
    const q=+r.querySelector('.fi-q').value;const u=r.querySelector('.fi-u').value;const a=u==='cup'?'cup':r.querySelector('.fi-a').value;
    let k=findIngKey(n);
    if(!k){k='x_'+n.toLowerCase().replace(/[^a-z0-9]+/g,'').slice(0,24)+'_'+Math.random().toString(36).slice(2,6);newIng[k]=a==='cup'?{n:n.slice(0,60),a:'cup'}:{n:n.slice(0,60),a,u}}
    const def=ING[k]||newIng[k];ing.push(def.a==='cup'?[k]:[k,q>0?q:1]);
  });
  if(!ing.length){err.textContent='Add at least one ingredient.';return}
  const steps=$('fSteps').value.split('\n').map(s=>s.trim()).filter(Boolean).slice(0,10);
  if(!steps.length){err.textContent='Add at least one method step.';$('fSteps').focus();return}
  const meal={id:editingId||('c_'+name.toLowerCase().replace(/[^a-z0-9]+/g,'').slice(0,20)+'_'+Date.now().toString(36)),name:name.slice(0,80),
    kcal:Math.min(1200,Math.max(100,Math.round(+$('fKcal').value||400))),mins:Math.min(300,Math.max(5,Math.round(+$('fMins').value||30))),
    simple:$('fSimple').checked?1:0,p:$('fP').value,ing,steps};
  const prev=lib.meals.find(x=>x.id===meal.id);if(prev&&prev.img)meal.img=prev.img;
  const wasScan=fromScan;
  if(fromScan&&scanDraftPhoto&&assetsApi){err.textContent='Saving the photo…';try{const up=await assetsApi.upload(scanDraftPhoto);if(up&&up.id)meal.img=up.id}catch(e){}err.textContent=''}
  Object.assign(lib.ing,newIng);
  const ix=lib.meals.findIndex(x=>x.id===meal.id);if(ix>=0)lib.meals[ix]=meal;else lib.meals.push(meal);
  fromScan=false;scanDraftPhoto=null;
  persistLib();render();
  if(wasScan){scanMsg=meal.name+' is in your library. Ready for the next one.';openSheet(scanHTML())}else{closeSheet();toast(editingId?'Meal updated':meal.name+' added to your library')}
}

/* ---------- misc ---------- */
let toastT;function toast(t){const el=$('toast');el.textContent=t;el.hidden=false;clearTimeout(toastT);toastT=setTimeout(()=>el.hidden=true,2400)}
function listText(){
  const {map,cup}=shopping();let out='Tea shopping list, week of '+fmtDate(WS)+' ('+state.servings+' portions)\n';
  AISLES.forEach(([a,label])=>{const ks=Object.keys(map).filter(k=>ING[k].a===a&&!state.ticks.includes(k));if(!ks.length)return;
    out+='\n'+label.toUpperCase()+'\n'+ks.map(k=>'- '+ING[k].n+': '+fmtQty(k,map[k].q)).join('\n')+'\n'});
  if(cup.size)out+='\nCHECK THE CUPBOARD\n'+[...cup].map(k=>ING[k].n).join(', ')+'\n';
  return out;
}
function setDay(i,id){const d=state.days[i];d.id=id;d.skip=false;d.locked=true;validate();update();closeSheet();toast(byId[id].name+' locked in for '+DAYNAME[i])}

document.addEventListener('click',e=>{
  const b=e.target.closest('[data-action]');if(!b)return;const a=b.dataset.action;const i=b.dataset.i!=null?+b.dataset.i:null;
  if(a==='serv'){state.servings=Math.min(8,Math.max(1,state.servings+ +b.dataset.d));update()}
  else if(a==='plan'){plan();update();toast('New week planned')}
  else if(a==='tab'){ui.tab=b.dataset.tab;render();window.scrollTo({top:0})}
  else if(a==='swap'){const d=state.days[i];const cur=d.id;const h=ui.hist[i]||[];if(cur)h.push(cur);ui.hist[i]=h.slice(-6);
    let n=pickFor(i,[cur].concat(ui.hist[i]));if(!n)n=pickFor(i,[cur]);if(n){d.id=n;d.locked=false}validate();update();if(b.dataset.close)closeSheet();if(n)toast(DAYNAME[i]+': '+byId[n].name)}
  else if(a==='settings'){openSheet(settingsHTML())}
  else if(a==='signout'){signOutUser().then(()=>location.reload())}
  else if(a==='lock'){const d=state.days[i];d.locked=!d.locked;update();if(b.dataset.close)closeSheet();toast(d.locked?DAYNAME[i]+' locked in':DAYNAME[i]+' unlocked')}
  else if(a==='skip'){const d=state.days[i];d.skip=!d.skip;if(d.skip)d.locked=false;else if(!d.id)d.id=pickFor(i);validate();update();if(b.dataset.close)closeSheet();toast(d.skip?DAYNAME[i]+' is a night off':DAYNAME[i]+' is back on')}
  else if(a==='recipe'){const m=byId[state.days[i].id];if(m)openSheet(recipeHTML(m,i))}
  else if(a==='librecipe'){const m=byId[b.dataset.id];if(m)openSheet(recipeHTML(m,null))}
  else if(a==='choose'){openSheet(chooseHTML(i))}
  else if(a==='set'){state.days[i].skip=false;setDay(i,b.dataset.id)}
  else if(a==='put'){setDay(+$('putDay').value,b.dataset.id)}
  else if(a==='close'){closeSheet()}
  else if(a==='filter'){ui.filter=b.dataset.f;render()}
  else if(a==='untick'){state.ticks=[];update()}
  else if(a==='have'){e.preventDefault();const k=b.dataset.k;if(!state.have.includes(k))state.have=state.have.concat(k);state.ticks=state.ticks.filter(x=>x!==k);update();toast(ING[k].n+' taken off the list')}
  else if(a==='unhave'){const k=b.dataset.k;state.have=state.have.filter(x=>x!==k);update();toast(ING[k].n+' is back on the list')}
  else if(a==='copy'){const txt=listText();const fb=$('copyFallback');
    const fallback=()=>{fb.value=txt;fb.hidden=false;fb.focus();fb.select();toast('Select the text below and copy it')};
    try{navigator.clipboard.writeText(txt).then(()=>{fb.hidden=true;toast('Shopping list copied')},fallback)}catch(err){fallback()}}
  else if(a==='ideas'){openSheet(ideasHTML())}
  else if(a==='scan'){scanMsg='';resetScan();openSheet(scanHTML())}
  else if(a==='scan-mode'){scan.mode=b.dataset.m;scanMsg='';refreshScan()}
  else if(a==='shot-del'){scan.shots.splice(+b.dataset.j,1);refreshScan()}
  else if(a==='scan-go'){runScan()}
  else if(a==='idea-q'){$('ideaReq').value=b.dataset.q;runIdeas()}
  else if(a==='idea-go'){runIdeas()}
  else if(a==='idea-add'){addIdeas()}
  else if(a==='addown'){openSheet(formHTML(null))}
  else if(a==='edit'){openSheet(formHTML(byId[b.dataset.id]))}
  else if(a==='f-addrow'){$('fIngs').insertAdjacentHTML('beforeend',rowHTML());const rs=$('fIngs').querySelectorAll('.fi-n');rs[rs.length-1].focus()}
  else if(a==='f-delrow'){b.closest('.frow').remove()}
  else if(a==='f-save'){saveForm()}
  else if(a==='delete'){
    if(!b.classList.contains('armed')){b.classList.add('armed');b.textContent='Tap again to delete';return}
    const id=b.dataset.id;lib.meals=lib.meals.filter(m=>m.id!==id);state.excluded=state.excluded.filter(x=>x!==id);
    state.days.forEach(d=>{if(d.id===id){d.id=null;d.locked=false}});
    persistLib();rebuild();state.days.forEach((d,j)=>{if(!d.skip&&!d.id)d.id=pickFor(j)});validate();update();closeSheet();toast('Meal deleted');
  }
});
document.addEventListener('change',e=>{
  const t=e.target;
  if(t.dataset&&t.dataset.shot){onShot(t);return}
  if(t.id==='shotKeep'){scan.keepFirst=t.checked;return}
  if(t.id==='simpleToggle'){state.simple=t.checked;update();toast(t.checked?'Only familiar meals will be planned':'All meals can be planned')}
  else if(t.dataset.tick){const k=t.dataset.tick;state.ticks=t.checked?state.ticks.concat(k):state.ticks.filter(x=>x!==k);update()}
  else if(t.dataset.rot){const id=t.dataset.rot;state.excluded=t.checked?state.excluded.filter(x=>x!==id):state.excluded.concat(id);update()}
  else if(t.classList.contains('fi-u')){const row=t.closest('.frow');row.querySelector('.fi-a').disabled=t.value==='cup';row.querySelector('.fi-q').disabled=t.value==='cup'}
});
document.addEventListener('input',e=>{
  const t=e.target;
  if(t.id==='libSearch'){ui.q=t.value;renderMeals()}
  else if(t.classList.contains('fi-n')){const k=findIngKey(t.value);if(!k)return;const row=t.closest('.frow');const d=ING[k];
    row.querySelector('.fi-u').value=d.a==='cup'?'cup':d.u;row.querySelector('.fi-a').value=d.a;
    row.querySelector('.fi-a').disabled=d.a==='cup';row.querySelector('.fi-q').disabled=d.a==='cup'}
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('sheet').hidden)closeSheet()});

if(fresh){plan();persistWeek()}
render();
new MutationObserver(hydrateImgs).observe(document.body,{childList:true,subtree:true});
connect();
}

