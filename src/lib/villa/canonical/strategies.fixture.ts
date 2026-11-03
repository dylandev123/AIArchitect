import type {ArchitecturalPlan} from './plan';
import {at,base,builder,compositionFirstFixture} from './compositionFirst.fixture';
/** DEVELOPER-AUTHORED EXPRESSIVENESS FIXTURES for the whole-house strategy records (library/architecture/strategies.ts).
 * They show that each strategy's stated expression compiles to editable geometry. They are not Terra output and are no
 * evidence that a model composes well. */
export type StrategyFixture='waterfront-pavilion'|'tropical-pavilion-court'|'courtyard-residence'|'stepped-multilevel'|'compact-two-volume';
export function strategyFixture(name:StrategyFixture):ArchitecturalPlan{
 if(name==='tropical-pavilion-court')return compositionFirstFixture('pavilion-court');
 if(name==='stepped-multilevel')return compositionFirstFixture('hillcrest');
 if(name==='waterfront-pavilion'){
  const p=base('waterfront-pavilion-estate','A waterfront residence with a dominant central living pavilion, two subordinate accommodation wings, a dramatic entrance and deep shaded facades: the double-height pavilion faces the water over a roofed terrace and pool, the lower wings flank it, and a tall door under a roofed porch receives arrival on the landward side.',[{id:'ground',above:null,rise:.2}]);
  const {room,portal}=builder(p);
  p.masses=[{id:'pavilion',role:'dominant central living pavilion'},{id:'west-wing',role:'subordinate accommodation wing'},{id:'east-wing',role:'subordinate accommodation wing'}];
  room('living','pavilion',12,12,at(null,'origin','centre'),{h:6});
  room('dining','pavilion',8,12,at('living','east','start'),{h:6});
  room('porch','pavilion',12,4,at('living','south','start'),{outdoor:true,h:4.4});
  room('terrace','pavilion',20,5,at('living','north','start'),{outdoor:true,h:3.4});
  room('west-gallery','west-wing',3,12,at('living','west','start'),{h:3.6});
  room('west-bed-1','west-wing',7,6,at('west-gallery','west','start'),{h:3.6});
  room('west-bed-2','west-wing',7,6,at('west-bed-1','north','start'),{h:3.6});
  room('east-gallery','east-wing',3,12,at('dining','east','start'),{h:3.6});
  room('east-bed-1','east-wing',7,6,at('east-gallery','east','start'),{h:3.6});
  room('east-bed-2','east-wing',7,6,at('east-bed-1','north','start'),{h:3.6});
  p.arrival='porch';p.terraces=['terrace'];
  portal('estate-door','living','porch',3,3.8,'door','centre','south');
  portal('living-dining','living','dining',4,3.4,'open');
  portal('living-west-gallery','living','west-gallery',1.6,2.6,'open');
  portal('dining-east-gallery','dining','east-gallery',1.6,2.6,'open');
  for(const w of ['west','east'])for(const n of ['1','2'])portal(`${w}-gallery-bed-${n}`,`${w}-gallery`,`${w}-bed-${n}`,1.1,2.2,'door','centre');
  p.roofs=[{space:'porch',form:'flat',rise:.22,overhang:0},{space:'terrace',form:'flat',rise:.22,overhang:0}];
  p.pools=[{id:'water-pool',placement:at('terrace','north','start',1.5),width:14,depth:5,waterDepth:1.4,level:'ground'}];
  p.landscape=[{id:'water-lawn',kind:'lawn',placement:at('water-pool','north','start',1),width:24,depth:8}];
  p.composition={
   volumes:[
    {id:'living-pavilion',masses:['pavilion'],tier:'primary',roof:'pavilion-roof',material:'limestone'},
    {id:'west-range',masses:['west-wing'],tier:'subordinate',roof:'west-roof',material:'timber'},
    {id:'east-range',masses:['east-wing'],tier:'subordinate',roof:'east-roof',material:'timber'},
   ],
   heightStep:1.5,
   roofSpans:[
    {id:'pavilion-roof',spaces:['living','dining'],form:'hip',rise:3,overhang:1,material:'bronze'},
    {id:'west-roof',spaces:['west-gallery','west-bed-1','west-bed-2'],form:'gable',rise:2,overhang:0,material:'timber'},
    {id:'east-roof',spaces:['east-gallery','east-bed-1','east-bed-2'],form:'gable',rise:2,overhang:0,material:'timber'},
   ],
   facades:[
    {id:'living-water',space:'living',side:'north',kind:'doors',to:'terrace',bays:3,width:3,height:4.4},
    {id:'dining-water',space:'dining',side:'north',kind:'doors',to:'terrace',bays:2,width:2.4,height:4.4},
    {id:'dining-land',space:'dining',side:'south',kind:'windows',bays:2,width:2.4,height:3.6,sill:.6},
    {id:'west-bed-view',space:'west-bed-1',side:'west',kind:'windows',bays:2,width:1.6,height:2,sill:.9},
    {id:'east-bed-view',space:'east-bed-1',side:'east',kind:'windows',bays:2,width:1.6,height:2,sill:.9},
   ],
   entrance:{portal:'estate-door',porch:'porch'},
  };
  return p;
 }
 if(name==='courtyard-residence'){
  const p=base('courtyard-residence','A tall hip-roofed living range closes the north of a private court; two lower gabled bedroom wings flank it and a low gate range closes the south, so the court is enclosed on all four sides.',[{id:'ground',above:null,rise:.2}]);
  const {room,portal}=builder(p);
  p.masses=[{id:'living-range',role:'primary living range'},{id:'west-wing',role:'secondary bedroom wing'},{id:'east-wing',role:'secondary bedroom wing'},{id:'gate',role:'subordinate gate range and entrance'},{id:'garden',role:'enclosed court'}];
  room('living','living-range',16,8,at(null,'origin','centre'),{h:5});
  room('court','garden',16,10,at('living','south','start'),{outdoor:true});
  room('west-bed-a','west-wing',6,5,at('court','west','start'),{h:3.6});
  room('west-bed-b','west-wing',6,5,at('west-bed-a','north','start'),{h:3.6});
  room('east-bed-a','east-wing',6,5,at('court','east','start'),{h:3.6});
  room('east-bed-b','east-wing',6,5,at('east-bed-a','north','start'),{h:3.6});
  room('gate-hall','gate',16,4,at('court','south','start'),{h:2.8});
  room('porch','gate',6,3,at('gate-hall','south','centre'),{outdoor:true,h:3});
  p.arrival='porch';p.terraces=['court'];
  portal('gate-door','gate-hall','porch',2,2.4,'door','centre','south');
  portal('gate-court','gate-hall','court',2.4,2.4,'door','centre');
  portal('living-court','living','court',3,2.8,'door','centre');
  for(const s of ['west','east'])for(const n of ['a','b'])portal(`${s}-court-${n}`,`${s}-bed-${n}`,'court',1.2,2.2,'door','centre');
  p.roofs=[{space:'living',form:'hip',rise:2,overhang:0},{space:'gate-hall',form:'flat',rise:.22,overhang:0},{space:'porch',form:'flat',rise:.22,overhang:0}];
  p.constraints=[{id:'court-enclosed',kind:'enclose',a:'court',amount:.9,reason:'the court must read as a room of the house, closed on all four sides'}];
  p.landscape=[{id:'court-bed',kind:'bed',placement:at('living','north','start',2),width:16,depth:3}];
  p.composition={
   volumes:[
    {id:'living-volume',masses:['living-range','garden'],tier:'primary',material:'limestone'},
    {id:'west-volume',masses:['west-wing'],tier:'secondary',roof:'west-roof',material:'timber'},
    {id:'east-volume',masses:['east-wing'],tier:'secondary',roof:'east-roof',material:'timber'},
    {id:'gate-volume',masses:['gate'],tier:'subordinate',material:'ivory'},
   ],
   heightStep:.8,
   roofSpans:[
    {id:'west-roof',spaces:['west-bed-a','west-bed-b'],form:'gable',rise:1.8,overhang:0,material:'timber'},
    {id:'east-roof',spaces:['east-bed-a','east-bed-b'],form:'gable',rise:1.8,overhang:0,material:'timber'},
   ],
   facades:[
    {id:'living-north',space:'living',side:'north',kind:'windows',bays:4,width:2.2,height:3.4,sill:.6},
    {id:'west-outer',space:'west-bed-a',side:'west',kind:'windows',bays:1,width:1.6,height:2,sill:.9},
    {id:'east-outer',space:'east-bed-a',side:'east',kind:'windows',bays:1,width:1.6,height:2,sill:.9},
   ],
   entrance:{portal:'gate-door',porch:'porch'},
  };
  return p;
 }
 const p=base('compact-two-volume-home','A taller day volume (living and dining under one gable) and a lower night volume (hall and two bedrooms under one roof) share a roofed entrance porch and a rear terrace.',[{id:'ground',above:null,rise:.2}]);
 const {room,portal}=builder(p);
 p.masses=[{id:'day',role:'primary day volume'},{id:'night',role:'subordinate night volume'}];
 room('living','day',7,7,at(null,'origin','centre'),{h:4});
 room('dining','day',5,7,at('living','east','start'),{h:4});
 room('porch','day',7,2.5,at('living','south','start'),{outdoor:true,h:3});
 room('terrace','day',12,3,at('living','north','start'),{outdoor:true});
 room('hall','night',2.2,7,at('dining','east','start'),{h:3});
 room('bed-1','night',4,3.5,at('hall','east','start'),{h:3});
 room('bed-2','night',4,3.5,at('bed-1','north','start'),{h:3});
 p.arrival='porch';p.terraces=['terrace'];
 portal('front-door','living','porch',1.6,2.4,'door','centre','south');
 portal('living-dining','living','dining',2.6,2.4,'open');
 portal('dining-hall','dining','hall',1.4,2.2,'open');
 portal('hall-bed-1','hall','bed-1',.9,2.1,'door','centre');
 portal('hall-bed-2','hall','bed-2',.9,2.1,'door','centre');
 p.roofs=[{space:'porch',form:'flat',rise:.2,overhang:0}];
 p.site={width:60,depth:60,elevation:0,grade:0,fall:'z'};
 p.landscape=[{id:'back-lawn',kind:'lawn',placement:at('terrace','north','start',1),width:12,depth:6}];
 p.composition={
  volumes:[
   {id:'day-volume',masses:['day'],tier:'primary',roof:'day-roof',material:'ivory'},
   {id:'night-volume',masses:['night'],tier:'subordinate',roof:'night-roof',material:'timber'},
  ],
  heightStep:.8,
  roofSpans:[
   {id:'day-roof',spaces:['living','dining'],form:'gable',rise:1.6,overhang:0,material:'timber'},
   {id:'night-roof',spaces:['hall','bed-1','bed-2'],form:'flat',rise:.22,overhang:0,material:'bronze'},
  ],
  facades:[
   {id:'living-garden',space:'living',side:'north',kind:'doors',to:'terrace',bays:2,width:1.6,height:2.4},
   {id:'dining-garden',space:'dining',side:'north',kind:'doors',to:'terrace',bays:1,width:2.4,height:2.4},
   {id:'bed-east',space:'bed-1',side:'east',kind:'windows',bays:1,width:1.4,height:1.5,sill:.9},
  ],
  entrance:{portal:'front-door',porch:'porch'},
 };
 return p;
}
