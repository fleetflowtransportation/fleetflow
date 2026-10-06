import fs from 'fs';

const rawCsv = `Nama Pemandu,Nombor Van,Tarikh Perjalanan,Lokasi Dari,Lokasi Ke,Tujuan Perjalanan,Odometer Mula (KM),Odometer Tamat (KM)
Mohd saiful azuan bin tajul ariffin ,Foton (VJQ8931),02/01/2026,Parking van,Parking van,Ambik budak bola di sentul Jalan batu(yatimi)Bawak staff dan pelajar main bola di padang sekolah seksyen 14 pj (yatimi)Bawak staff ke selayang bg brang groceries pada Client (kavita)bawak sfaff Dan kanak2 ke restaurant rebung (Bell) ,63189,63410
Aziz,Foton (VJQ8931),10/01/2026,YCK,Pusat Kreatif Tuanku Bainun - YCK - IWK Eco Park - Pusat Kreatif Tunku Bainun - YCK - Parking,Hantar Young chef program & program teater,63410,63601
Syafiq,Foton (VJQ8931),10/01/2026,Yck,Yck,Ambil staff dan remaja-iwk(ashikin),63601,63622
Syafiq,Foton (VJQ8931),17/01/2026,Yck,Yck,"1.hantar,remaja-young cooking chef(yatimie)2.hantar-remaja pergi IWK(feroz)",63622,63670
Zai,Foton (VJQ8931),26/01/2026,Yck,Smk L bukit bintang,Training football ,63671,63702
Zai,Foton (VJQ8931),27/01/2026,Yck,"Quill mall , time square",Pickup mknan,63702,63717
Aziz,Foton (VJQ8931),28/01/2026,YCK,"PJBA, Kelana Jaya",Bawa staff sambut farewell aimi,63717,63753
Syafiq,Foton (VJQ8931),29/01/2026,Yck,Yck,1.bawa-staff dan remaja badminton(timi),63753,63767
Zai,Foton (VJQ8931),06/02/2026,Yck,"Tasik perdana, mydin",Hantar org n beli brg,63767,63786
Syafiq,Foton (VJQ8931),06/02/2026,Yck,Yck,Rebung,63786,63797
Syafiq,Foton (VJQ8931),07/02/2026,Yck,Yck,1.hantar/ambil-remaja dan staff-cheff(timi)2.hantar/ambil-training bola(kak shanti)3.bawa-staff topup touch n go(abg nazmi),63797,63881
Zai,Foton (VJQ8931),09/02/2026,Yck,Smk L bukit bintang ,Football,63881,63909
Zai,Foton (VJQ8931),11/02/2026,Yck,Smk sri rampai,Hantar barang,63909,63929
Zai,Foton (VJQ8931),11/02/2026,Yck,Bandar bukit puchong,Ambik oren,63929,63989
Zai,Foton (VJQ8931),12/02/2026,Yck,"British council, papavan, tasik titiwangsa","Pickup sijil, hntr van, main taman",63989,64065
Zai,Foton (VJQ8931),13/02/2026,Yck,"Kedai borong, rebung",Beli mineral n mkn2 rebung,64065,64082
Zai,Foton (VJQ8931),14/02/2026,Yck,"Pemborong chowkit, pusat Kreatif kanak kanak","Beli barang, young chef cooking class",64082,64141
Syafiq,Foton (VJQ8931),15/02/2026,Parking ,Parking,"Bawa-remaja dan staff,training bola,seremban(abg nazmi)",64141,64299
Syafiq,Foton (VJQ8931),16/02/2026,Prking van,Parking van,1.bawa staff ke hq lama-2kali mydin hq lama-hantar yck(atirah)2.bawa staff-quill mall(syikin)3.bawa staff-spm-time square(syikin),64299,64329
Zai,Foton (VJQ8931),20/02/2026,Yck,"Rimbun anggun nursery, Smk L Bukit bintang","Beli pokok, training football",64329,64372
Syafiq,Foton (VJQ8931),21/02/2026,Parking van,Parking van,1.bawa staff-hospital selayang(abg nazmi)2.bawa staff dan remaja-training bola(abng nazmi),64372,64434
Syafiq,Foton (VJQ8931),22/02/2026,Parking van,Parking van,Ambil roti(timi),64434,64438
Zai,Foton (VJQ8931),23/02/2026,Yck,Hospital ampang,Byr bil hospital,64438,64474
Syafiq,Foton (VJQ8931),24/02/2026,Parking van,Parking van,Ambil yasmin pjba-yck(aimi),64474,64508
Zai,Foton (VJQ8931),24/02/2026,Yck,"Shelter, kampung wira damai, sekolah al aliyah gombak","Urusan client syafiqa, hantar yasmin PJBA",64438,64628
Syafiq,Foton (VJQ8931),25/02/2026,Parking van,Parking van,1.ambil yasmin-pjba-yck(aimi),64628,64661
Zai,Foton (VJQ8931),25/02/2026,Yck,PJBA,Hantar kak hasini ,64661,64699
Syafiq,Foton (VJQ8931),25/02/2026,Parking van,Parking van,1.bawa staff-unhcr(kavitha),64699,64721
Zai,Foton (VJQ8931),25/02/2026,Yck,PJBA,Hantar yasmin,64721,64758
Syafiq,Foton (VJQ8931),26/02/2026,Parking van,Parking van,1.ambil yasmin pjba(aimi)2.bawa staff-cheras-spm(yaya),64758,64817
Zai,Foton (VJQ8931),26/02/2026,Yck,"Bangi, Pjba","Hantar bantuan, Hantar yasmin",64817,64933
Syafiq,Foton (VJQ8931),26/02/2026,Parking van,Parking van,"1.bawa staff,titiwangsa training bola(timi)",64934,64942
Syafiq,Foton (VJQ8931),27/02/2026,Parking van,Parking van,Ambil yasmin-pjba(aimi),64942,64976
Zai,Foton (VJQ8931),27/02/2026,Yck,Smk tinggi setapak,Urusan sekolah (kavi),64976,64990
Zai,Foton (VJQ8931),27/02/2026,Yck,Smk l bukit bintang,Football training,65074,65101
Syafiq,Foton (VJQ8931),28/02/2026,Parking van,Parking van,1.ambil yasmin dari pjba(aimi)2.bawa staff-bukit sentosa(kak ira),64990,65074
Syafiq,Foton (VJQ8931),28/02/2026,Parking van,Parking van,Bawa-remaja dan staff(abng nazmi),65101,65130
Syafiq,Foton (VJQ8931),02/03/2026,Parking van,Parking van,1.ambil hantar staff-pjba-hkl(syafiqah)2.bawa staff-aa pharmacy-cheras(abng nazmi),65130,65263
Syafiq,Foton (VJQ8931),03/03/2026,Parking van,Parking van,1.ambil/hantar yasmin(aimi)2.ambil roti(syikin),65263,65341
Khai,Foton (VJQ8931),04/03/2026,Pjba,Yck ,1.bwk yasmin ,65341,65414
Khai,Foton (VJQ8931),05/03/2026,Parking van,Parking,"1 bawak staff- AA Famasi- Cheras ( Nazmi) 2, sent card jemputan (Miss kala)",65414,65519
Syafiq,Foton (VJQ8931),06/03/2026,Parking van,Pjba-yck,Ambil yasmin dari pjba(aimi),65519,65552
Khai,Foton (VJQ8931),06/03/2026,Parking van ,Pj ,1 bawa staff dan remaja- traning bola(Timi),65552,65603
Syafiq,Foton (VJQ8931),07/03/2026,Parking,Sekolah bukit bintang-pjba,1.bawa-staff dan remaja training bola(abng nazmi)2.pjba(gopal),65603,65662
Khai,Foton (VJQ8931),10/03/2026,1 yck,Shah alam bukit raja,Amek barang groceries (Hasini,65662,65746
Syafiq,Foton (VJQ8931),11/03/2026,Parking van,Taylor universiti-mydin chowkit-istana negara,"1.bawa,guru dan kenak-kanak(cikgu fiza)2.bawa staff-beli A4(kiss)3.bawa-ceo dan hod(bell)",65746,65811
Aziz,Foton (VJQ8931),12/03/2026,YCK,"IWK, YCK, Shell, Parking","Bawa remaja iftar di IWK, Isi minyak Van",65811,65832
Khai,Foton (VJQ8931),13/03/2026,Yck parking keta,"1 Hkl, 2 Pjba 3 bukit kiara resort 4 yck",Hantar yasmin blk pjba(syafikah) 2 Ambil staff hkl( syafikah) 3 bawa remaja dan staff berbuka puasa( bell ),65832,65903
Khai,Foton (VJQ8931),16/03/2026,Parking - yck,"1 Mydin amek barang groceries, harta ke centre lama ,  yck, hospital selayang","1 Amek barang groceries , 2 hantar ke centre lama 3 hospital selayang payments bil (Nazmi)",65903,65941
Khai,Foton (VJQ8931),13/04/2026,Parking,Bukit bintang boy pj,Remaja training bola,65956,65984
Khai,Foton (VJQ8931),14/04/2026,Parking Van,1-Berjaya time square 2- chan sow lin 3- pjba,"Mengambil Roti, mengambil groceries, menhantar yasmin balik",65984,66051
Khai,Foton (VJQ8931),16/04/2026,Parking van,1-Eon setiawangsa 2- Pjba,Menbawa 3 staff.. & client 8 membeli barang sumbang Rhb,66053,66149
Syafiq,Foton (VJQ8931),17/04/2026,Parking,Rebung,1.bawa remaja dan staff rebung(feroz),66149,66160
Mohd saiful azuan bin tajul ariffin ,Foton (VJQ8931),20/04/2026,Parking van,Titiwangsa ,Bawak staff dan pelajar main bola di taman titiwangsa ,66160,66172
Mohd saiful azuan bin tajul ariffin ,Foton (VJQ8931),24/04/2026,Parking van,"KWC fishion pudu,seksyen 14 pj","Bawak staff ke KWC fishion pudu beli brang,Bawak staff dan pelajar main bola di padang sekolah seksyen 14 pj ",66172,66220
Mohd saiful azuan bin tajul ariffin ,Foton (VJQ8931),25/04/2026,Parking van,"Football training padang brickfields, W(sentul) badminton ","Bawak staff dan pelajar main bola di padang brickfields bangsar, Bawak staff dan pelajar main badminton di W(sentul) ",66220,66249
Mohd saiful azuan bin tajul ariffin ,Foton (VJQ8931),26/04/2026,Parking van,"Sunway mall,aeon setiawangsa, sentul",Ambil roti di sunway putra mall (yatimi) Bawak staff dan client ke aeon setiawangsa beli brang dapur(atirah) Bawak staff dan pelajar main bola futsal di sentul(yatimi) ,66249,66289
Mohd saiful azuan bin tajul ariffin ,Foton (VJQ8931),27/04/2026,Parking van,"Hantar dokumen di cheras, home visit kepong","Hantar dokumen di Wisma zelan cheers, Bawak staff ke ppr bering in kepong ",66289,66334
Syafiq,Foton (VJQ8931),07/05/2026,Parking,Pjba,Hantar yasmin balik pjba(syafiqah),66337,66371
Syafiq,Foton (VJQ8931),15/05/2026,Parking,1.padangs-spm-yck-hq lama-yck-rebung-yck,Bawa staff yoga(timi)2.bawa staff ambil roti(timi)3.bawa staff-ambil barang hq lama(kak ira)4.rebung,66371,66388
Syafiq,Foton (VJQ8931),17/05/2026,Parking,Kl gate way-spm-wee lee heng,Hantar/ambil staff-suezcap(yatimi)2.bawa staff ambil roti(syikin)3.bawa staff pergi beli barang pantry(kak leen),66388,66442
Mohd saiful azuan bin tajul ariffin ,Foton (VJQ8931),18/05/2026,Parking van,Pj,Bawak staff dan pelajar main dipadang seksyeb 14 pj,66442,66467
Mohd saiful azuan bin tajul ariffin ,Foton (VJQ8931),19/05/2026,Parking van,"Mydin, tiong nam, time square, Q mall",Bawak staff ke mydin ambil brang groceries dan Bawak staff ke time square ambil roti and kfc,66467,66486
Mohd saiful azuan bin tajul ariffin ,Foton (VJQ8931),22/05/2026,Parking van,"Tasik titiwangsa, selayang, pj","Bawak staff dan pelajar ke tasik titiwangsa hari sukan, bawah staff hantar brang pada Client kt selayang, hantar yasmin balik pjba",66486,66575
Mohd saiful azuan bin tajul ariffin ,Foton (VJQ8931),23/05/2026,Parking van,"Wangsamaju, putra mahkota bangi, bangsar ","Bawak staff dan pelajar ke padang sukan wangsamaju, Bawak staff ke putra mahkota bangi, ambil brang kt umah client di Bangsar ",66575,66710
Syafiq,Foton (VJQ8931),29/05/2026,Parking,Rebung,Bawa remaja dengan staff ,66710,66720
Syafiq,Foton (VJQ8931),04/06/2026,Parking,Bukit lagong,Bawa staff dan remaja hiking(feroz),66720,66759
Mohd saiful azuan bin tajul ariffin ,Foton (VJQ8931),07/06/2026,Parking van,"Sunway putra mall, University malaya bangsar","Bawak staff ambik roti di sunway putra mall, Bawak staff dan pelajar ke University malaya di bangsar",66759,66802
Syafiq,Foton (VJQ8931),26/06/2026,Parking,Yck-hta-rebung-yck,Hantar kanak2 dan staff hta(kavitha)2.rebung,66861,66877
Syafiq,Foton (VJQ8931),27/06/2026,Parking,Bukit bintang-jinjang-jalan ipoh-jinjang-yck-bukit bintang,"Hantar/ambil-staff remaja dan kanak2 lalaport(syikin)2.bawa-staff pergi rumah klien,ambil klien pergi beli pakaian sekolah(kavitha)",66877,66940
Mohd saiful azuan bin tajul ariffin ,Foton (VJQ8931),29/06/2026,Parking van,"Selayang, sentul, pj","Bawak staff ke hospital selayang bayar bil, bawak staff ke sentul ambil brang, Bawak staff dan pelajar main bola di padang pj",66040,67013
Syafiq,Foton (VJQ8931),03/07/2026,Parking,Yck-parking-rebung,Ambil/buang kerusi 2.bawa staff dan kanak2 rebung,67015,67029
Mohd saiful azuan bin tajul ariffin ,Foton (VJQ8931),04/07/2026,Parking van,"Taman botani, subang jaya","Bawak staff dan pelajar serta client Indonesia (budaj bola), Bawak staff ke subang jaya ambil brang ",67031,67114
Mohd saiful azuan bin tajul ariffin ,Foton (VJQ8931),05/07/2026,Parking van,"Sunway putra mall, bangsar ","Bawak staff ke sunway putra mall ambil roti donor, Bawak staff dan pelajar serta client Indonesia ke padang bangsar ",67114,67142
Mohd saiful azuan bin tajul ariffin ,Foton (VJQ8931),06/07/2026,Parking van,Tasik titiwangsa ,Bawak staff dan pelajar main di tasik titiwangsa ,67141,67152
Mohd saiful azuan bin tajul ariffin ,Foton (VJQ8931),10/07/2026,Parking van,Bukit aman ,Bawak staff dan ke restaurant rebung ,67152,67163
Syafiq,Foton (VJQ8931),16/07/2026,Parking,Chansowlin,Collect biskut ,67163,67183
Mohd saiful azuan bin tajul ariffin ,Foton (VJQ8931),18/07/2026,Parking van,Bangsar,Bawak staff dan pelajar main bola di padang kompleks sukan bangsar,67183,67220
Mohd saiful azuan bin tajul ariffin ,Foton (VJQ8931),19/07/2026,Parking van,Central market ,Bawak staff dan pelajar ke Central market (pasar seni) ,67220,67239
Syafiq,Foton (VJQ8931),17/07/2026,Parking,Rebung,Bawa kanak2 pergi rebung,67183,67194
Mohd saiful azuan bin tajul ariffin ,Foton (VJQ8931),20/07/2026,Parking van,Sogo mall. Pjba. Titiwangsa ,"Bawak staff ke soga mall beli kek, ambil staff Pjba Bawak ke HKL, Bawak staff dan pelajar main bola di padang tasik titiwangsa ",67239,67290
Mohd saiful azuan bin tajul ariffin ,Foton (VJQ8931),21/07/2026,Parking van,Kimi carwash ,Bawak van g basuh kt komi carwash ,67290,67291
Mohd saiful azuan bin tajul ariffin ,Foton (VJQ8931),24/07/2026,Parking can,"Chow kit, wangsamaju, melawati, sentul, rebung","Bawak staff beli brang utk HB pelajar, Bawak staff dan pelajar ke restaurant rebung ",67291,67339
Syafiq,Foton (VJQ8931),26/07/2026,Parking,Kota damansara-sentul-mydin chowkit-selayang-kotadamansara,"Hantar/ambil staff khusus(kak hasini)bawa remaja dan staff main badminton(timi),bawa staff beli barang dekat mydin dan hantar dekat selayang(kak ira)",67339,67461
Syafiq,Foton (VJQ8931),30/07/2026,Parking,Hq lama-mahsa avenue-pjba-hq lama-yck,Hantar/ambil sw dekat hq lama bahgi susu(abng nazmi)2.hantar yasmin mahsa avenue(adriana)3.hantar staff dan susu dekat pjba(syafiqah),67461,67503
Syafiq,Foton (VJQ8931),31/07/2026,Parking,Rebung,Bawa kanak2 dan staff pergi rebung,67503,67514
Mohd saiful azuan bin tajul ariffin ,Foton (VJQ8931),02/08/2026,Parking van,Damansara perdana,Bawak staff dan pelajar ke damansara perdana tonton arts performances ,67514,67558
Mohd saiful azuan bin tajul ariffin ,Foton (VJQ8931),07/08/2026,Parking van ,Restoran rebung ,Bawak staff dan pelajar ke restaurant rebung g ,67560,67571
Syafiq,Foton (VJQ8931),14/08/2026,Parking,Rebung,Bawa kanak2 dan staff rebung,67571,67584
Mohd saiful azuan bin tajul ariffin ,Foton (VJQ8931),16/08/2026,Parking van ,Bangsar,Bawak staff dan pelajar main bola di padang bangsar ,67584,67603
Mohd saiful azuan bin tajul ariffin ,Foton (VJQ8931),17/08/2026,Parking van,"Pjba, subang, hkl, tasik titiwangsa ","Bawak yasmin blik ke Pjba, Bawak staff Pjba ke rumah client di subang dan bawak client ke hkl, Bawak staff dan pelajar main dipadang tasik titiwangsa ",67603,67664
Mohd saiful azuan bin tajul ariffin ,Foton (VJQ8931),21/08/2026,Parking van,"Sunway putra mall, Q mall, restoren rebung","Bawah staff belu brang di sunway putra mall dan Q mall, Bawak staff dan pelajar ke restaurant rebung ",67664,67682
Syafiq,Foton (VJQ8931),23/08/2026,Parking,Quill mall-selayang-sentul,Bawa staff pergi beli barang dan hantar pada klien(kak ira)2.bawa remaja dan staff main badminton(timi),67682,67733
Mohd saiful azuan bin tajul ariffin ,Foton (VJQ8931),24/08/2026,Parking van,"Utc sentul, jpn jalan duta, tasik titiwangsa ","Bawak staff dan pelajar ke utc sentu dan jpn jalan duta, Bawak staff dan pelajar main di tasik titiwangsa ",67733,67757
Mohd saiful azuan bin tajul ariffin ,Foton (VJQ8931),29/08/2026,Parking van,"Pjba, citta mall subang, sunway putra mall, mydin","Bawak staff Pjba ke citta mall bersama-sama kanak2, Bawak staff ke sunway putra mall beli brang dan mydin ",67759,67819
Mohd saiful azuan bin tajul ariffin ,Foton (VJQ8931),01/09/2026,Parking van,Pusat kreatif kanak2 tunku bainun TTDI,Bawak staff dan kanak2 ke pusat kreatif kanak2 tunku bainun ,67819,67853
Syafiq,Foton (VJQ8931),06/09/2026,Parking,Kl towers,Hantar/ambil staff dan remaja ,67969,67982
Mohd saiful azuan bin tajul ariffin ,Foton (VJQ8931),14/09/2026,Parking van,"Ampang hilir, Petaling jaya","Bawak staff belu bunga di ampang hilir, Bawak staff dan pelajar main bola di padang sekolah seksyen 14 pj ",67982,68029
Mohd saiful azuan bin tajul ariffin ,Foton (VJQ8931),18/09/2026,Parking van,Bukit aman,Bawak staff dan pelajar ke restaurant rebung ,68029,68040
Syafiq,Foton (VJQ8931),20/09/2026,Parking,Sunway,Bawa staff dan remaja pergi teater,68040,68085
Mohd saiful azuan bin tajul ariffin ,Foton (VJQ8931),21/09/2026,Parking van,Sk. Bintang pj,Bawak staff dan pelajar main bola di padang sekolah seksyen 14 pj ,68085,68112
Mohd saiful azuan bin tajul ariffin ,Foton (VJQ8931),26/09/2026,Parking van,"Sunway putra mall, mydin Chow kit, W sentul badminton centre ","Bawak staff ke sunway putra mall ngan mydin beli brang dapur client, Bawak staff dan pelajar main badminton di W sentul badminton centre ",68112,68135
Mohd saiful azuan bin tajul ariffin ,Foton (VJQ8931),27/09/2026,Parking van,Bangsar ,Bawak staff dan pelajar main bola di padang bangsar ,68135,68159
Mohd saiful azuan bin tajul ariffin ,Foton (VJQ8931),28/09/2026,Parking van,Pasar raya wan lee,Bawak staff ke pasar raya wan lee beli brang ,68159,68163
Syafiq,Foton (VJQ8931),02/10/2026,Parking,Rebung,Bawa staff dan remaja rebung,68163,68174
Syafiq,Alza (VQM7753),07/03/2026,Parking,Cheras,1.bawa staff-cheras ambil reset(abg nazmi),184,235
Syafiq,Alza (VQM7753),09/03/2026,Parking ,Pjba-jalan maharajalela-puchong,"1.ambil/hantar-yasmin(aimi)2.hantar staff-klscah(kak hasini)3.papavan,ambil haice",235,329
Aziz,Alza (VQM7753),12/03/2026,YCK,Sogo,Bawa Kak Zai & Miss Kala untuk terima Sumbangan Cheque ,329,333
Syafiq,Alza (VQM7753),13/03/2026,Parking,1.pjba-hkl-ulang alik danau-,1.ambil yasmin dan hantar staff hkl(syafiqah),333,399
Belle,Alza (VQM7753),13/03/2026,Parking,Bukit kiara resort,Bawa remaja berbuka puasa,399,423
Syafiq,Alza (VQM7753),17/03/2026,Parking,1.pjba-bts-cheras-pjba,1.ambil/hantar-yasmin(syafiqah)2.ambil roti(syikin)3.bawa staff-hantar barang grocery(abg nazmi),423,556
Syafiq,Alza (VQM7753),18/03/2026,Parking,Ppr renjang-aeon wangsa maju,Bawa staff beli pakaian sekolah(atirah),556,581
Khai,Alza (VQM7753),26/03/2026,Parking ,Subang jaya,1-Pengambilan medical (nazmi),581,637
Yatimi,Alza (VQM7753),27/03/2026,Yck,Bukit Bintang Secondary Boys School ,Escort training football,637,665
Syafiq,Alza (VQM7753),30/03/2026,Parking,1.pjba-pj jalan gasing,1.Ambil yasmin(syafiqah)2.hantar yasmin pergi klinik(selvi),665,729
Syafiq,Alza (VQM7753),31/03/2026,Yck,Pjba-yck,Ambil yasmin,729,762
Khai,Alza (VQM7753),31/03/2026,Parking,1-kepong 2- jln gombak 3- utc sentul 4- kepong 5-utc sentul 6-kepong 7- yck 8-parking,Sattel urusan client (nazmi) utk bt document passport ,762,890
Khai,Alza (VQM7753),01/04/2026,Parking,1-Pjba 2- Hospitals selayang (kavitha),"Mengambil remaja , Mengambil staff ",890,956
Khai,Alza (VQM7753),02/04/2026,Parking ,1- Pjba 2- shah alam ,"Mengambil remaja yasmin di pjba, menghantar  staff  (Nazmi)",957,1071
Syafiq,Alza (VQM7753),03/04/2026,Parking,Pjba,Ambil yasmin(adriana),1071,1105
Syafiq,Alza (VQM7753),03/04/2026,Parking,Pjba-hkl-wan lee heng-pjba,1.hantar/ambil-yasmin(adriana)2.bawa staff beli barang pantry(kak pika)3.hantar/ambil staff-hkl(miss kala),1071,1154
Syafiq,Alza (VQM7753),05/04/2026,Parking,Spm,Ambil roti(syikin),1154,1157
Syafiq,Alza (VQM7753),06/04/2026,Parking,Pjba-jabatan pendidikan wilayah-jabatan pendidikan negeri selangor,1.hantar/ambil-yasmin(adriana)2.bawa staff-jalan duta-shah alam,1157,1310
Syafiq,Alza (VQM7753),07/04/2026,Parking,Perodua kg baru,Servis alza,1310,1315
Syafiq,Alza (VQM7753),08/04/2026,Prking,Pjba-lotus ampang-tiara imperio bangi,"Ambil/hantar yasmin(adriana)2.bawa staff beli susu,dan hantar(abng nazmi)",1315,1463
Bell,Alza (VQM7753),09/04/2026,YCK,"Mamart Food Sungai Besi 28-00-04 Apartment Fasa 1A Desa Tasik, Jalan 2/146, Sungai Besi, 57000 Kuala Lumpur, Wilayah Persekutuan Kuala Lumpur",Pembelian barang open house,1533,1569
Syafiq,Alza (VQM7753),09/04/2026,Parking,Pjba-damansara,1.ambil yasmin(adriana)2.bawa staff beli barang deko(yaya),1463,1533
Yatimi,Alza (VQM7753),10/04/2026,YCK,Bukit Bintang Secondary Boys School,Escort Football Training,1586,1613
Syafiq,Alza (VQM7753),10/04/2026,Parking,Bts-quill mall,Beli barang hari raya(zulaika),1569,1586
Yatimi,Alza (VQM7753),13/04/2026,YCK,Decathlon Petaling Jaya,Buat tempahan baju untuk remaja bola Mexico,1650,1677
Syafiq,Alza (VQM7753),13/04/2026,Parking,Pjba-hkl,Ambil staff dan remaja-hantar hkl(syafiqah),1613,1650
Aziz,Alza (VQM7753),15/04/2026,YCK,"PJBA, Kelana Jaya",Bawa staff HQ meeting,1877,1913
Syafiq,Alza (VQM7753),14/04/2026,Parking,Pjba-pertama complex-klang-indonesia embassy-klang-yck,"Ambil yasmin(adriana)2.bawa staff pergi klang,ambil klien,pergi embassy-klang(yaya)",1677,1877
Syafiq,Alza (VQM7753),19/04/2026,Parking,Cheras,Hantar barang grocery(yaya),1913,1940
Syafiq,Alza (VQM7753),20/04/2026,Parking,Pjba-yck-setia city mall-yck-pjba,1.hantar/ambil-yasmin(syafiqah)2.bawa staff pergi shah alam(syafiqah),1940,2089
Syafiq,Alza (VQM7753),21/04/2026,Parking,Pjba-hospital selayang,Ambil yasmin(adriana)2.bawa staff pergi selayang(kavitha),2089,2153
Syafiq,Alza (VQM7753),22/04/2026,Parking,Pjba-pudu-jalan bukit petaling-bangsar-cheras-kajang,1.ambil/hantar yasmin(adriana)2.bawa staff-hantar/ambil peti cash-ambil laptop(belle)3.bawa staff-aa farmasi-tugan mecahnary-tiara imperio(abng nazmi),2153,2342
Syafiq,Alza (VQM7753),23/04/2026,Parking,1.pjba-lorong haji taib-jalan raja abdullah,1.ambil/hantar-yasmin balik pjba(adriana)2.bawa staff home visit(kavitha)3.bawa staff pergi wisma rkt(kak ira),2342,2417
Syafiq,Alza (VQM7753),24/04/2026,Parking,Pjba-chowkit,Ambil yasmin(adriana) 2.bawa staff beli air meneral dan buah(timi),2417,2454
Syafiq,Alza (VQM7753),27/04/2026,Parking,1.mutiara damansara-hkl-pjba,1.bawa staff pergi surian residences(atirah)2.bawa staff pergi hkl(atirah)3.hantar yasmin balik pjba(adriana),2454,2518
Bell,Alza (VQM7753),28/04/2026,YCK,BTS Dan Quill City Mall,Collect roti Dan ayam KFC,2518,2533
Bell ,Alza (VQM7753),29/04/2026,YCK,"Mesra Terrace, Jalan Dutamas",Return tab ( Neo English),2533,2547
Nadhirah ,Alza (VQM7753),29/04/2026,Yayasan Chowkit ,Quil City Mall,Ambil hadiah Program English Fiesta,2547,2550
Yatimi,Alza (VQM7753),30/04/2026,YCK,Decathlon Petaling Jaya,Ambil barang football Mexico,2550,2577
Mohd saiful azuan bin tajul ariffin ,Alza (VQM7753),04/05/2026,Parking JKG,"HKL,P.J","Bawak staff ke hkl ambil resit bayaran bil, Bawak yasmin blik ke pj",2577,2614
Syafiq,Alza (VQM7753),05/05/2026,Parking,quill mall,Ambil kfc,2614,2617
Syafiq,Alza (VQM7753),06/05/2026,Parking,1.wan lee heng cash-pjba,Bawa staff beli air mineral(belle)2.hantar yasmin balik pjba(syafiqah),2617,2658
Syafiq,Alza (VQM7753),08/05/2026,Parking,1.pjba,Hantar yasmin balik pjba(syafiqah),2659,2693
Mohd saiful azuan bin tajul ariffin ,Alza (VQM7753),11/05/2026,Parking jkg,Pjba(pj) ,Ambik yasmin Bawak ke sekolah (hq) ,2693,2728
Syafiq,Alza (VQM7753),11/05/2026,Parking,Spm,Bawa staff beli kek(kisswah),2728,2731
Syafiq,Alza (VQM7753),12/05/2026,Parking,Quill mall,Bawa staff ambil kfc,2731,2734
Syafiq,Alza (VQM7753),20/05/2026,Parking,1.selayang,1.bawa staff bayar yuran(kak ira),2734,2765
Syafiq,Alza (VQM7753),25/05/2026,Parking,Pjba-pandan indah-pjba-yck,Hantar yasmin balik beraya(adriana),2765,2853
Syafiq,Alza (VQM7753),26/05/2026,Parking,Klang-hospital selayang-yck-utc sentul,Bawa staff pergi klang-hospital selayang(yaya)2.bawa staff pergi utc sentul(tirah),2853,2972
Syafiq,Alza (VQM7753),28/05/2026,Parking,Quill mall,Bawa staff ambil kfc(belle),2972,2974
Syafiq,Alza (VQM7753),29/05/2026,Parking,Spm,Bawa staff beli barang(yaya),2974,2978
Yatimi,Alza (VQM7753),30/05/2026,YCK,W Badminton Sentul,Escort sukan badminton,2978,2991
Yatimi,Alza (VQM7753),30/05/2026,YCK,NS7 Futsal Sentul,Escort sukan futsal,2991,3000
nadhirah,Alza (VQM7753),04/06/2026,YCK,Bukit Lagong,Hiking bersama secondary,3052,3089
Syafiq,Alza (VQM7753),05/06/2026,Parking,Pjba-pandan indah-pjba-yck,Ambil staff dekat pjba-bawa staff pergi ambil yasmin(adriana),3089,3169
Syafiq,Alza (VQM7753),09/06/2026,Parking,Aa pharmacy-lotus ampang-cheras-puchong,1.bawa staff beli dan hantar barang klien(abg nazmi)2.hantar van foton bengkel,3169,3276
Aziz,Alza (VQM7753),10/06/2026,YCK,Kedai Borong Chowkit,Beli barang mineral untuk event symposium,3276,3280
Bell,Alza (VQM7753),11/06/2026,YCK,SD Guthrie Berhad (YSD) ,Symposium on Children’s Rights ,3280,3333
Syafiq,Alza (VQM7753),12/06/2026,Parking,Setapak-rebung,Bawa staff ambil reset(atirah)2.rebung,3333,3360
Syafiq,Alza (VQM7753),14/06/2026,Parking,1.selayang-yck-spm-pertama complex-yck-jalan ipoh-chowkit,Hantar/ambil staff kumon(kak hasini)2.bawa staff ambil roti(timi)3.bawa staff pergi pertama complex(kak ira)bawa staff dan klien dan hantar klien balik case management(kak ira),3360,3444
Syafiq,Alza (VQM7753),15/06/2026,Parking,Menara tan&tan-mydin chowkit-pjba, pergi hantar dokumen hq(bawa staff pergi beli A4(ain)3.hantar yasmin balik pjba(adriana),3444,3491
Syafiq,Alza (VQM7753),18/06/2026,Parking,Pjba,Hantar yasmin balik(ika),3491,3528
Syafiq,Alza (VQM7753),19/06/2026,Parking,Chowkit-jalan raja abdullah,Bawa staff beli barang pantry(kak baiti)2.bawa staff pergi menara 3 dbkl(kak tirah),3528,3536
Syafiq,Alza (VQM7753),22/06/2026,Parking,Pjba-ttwangsa-mrt ttwangsa,Hantar yasmin balik pjba(ika)bawa kanak2 main bola(syikin)3.hantar remaja dkt mrt(syikin),3536,3584
Syafiq,Alza (VQM7753),28/06/2026,Parking,Spm,Bawa staff ambil roti(syikin,3620,3624
Syafiq,Alza (VQM7753),29/06/2026,Parking,Aloeva farmasi-seri kembangan-yck,"Bawa staff beli susu,hantar dekat klien(abng nazmi)",3624,3699
Syafiq,Alza (VQM7753),01/07/2026,Parking,Yck-hta-pjba-yck,Bawa staff pergi hta(kak hasini)hantar yasmin balik pjba(syafiqah),3699,3740
Syafiq,Alza (VQM7753),02/07/2026,Parking,Ampang-yck-hospital selayang-yck-jalan ilmu-yck, Bawa staff ambil reset(kavitha)2.bawa staff bayar bill(atirah)3.hantar yasmin mahsa avenue(adriana),3740,3828
Yatimi,Alza (VQM7753),04/07/2026,YCK,Taman Botani,Hantar remaja dan Team Football Indonesia ,3828,3839
Mohd saiful azuan bin tajul ariffin ,Alza (VQM7753),07/07/2026,Parking kereta,Pjba,Hantar yasmin balik ke Pjba ,3889,3915
Aziz,Alza (VQM7753),09/07/2026,YCK,Pertama complex,Beli gift retreat yck,3915,3921
Syafiq,Alza (VQM7753),07/07/2026,Parking,Yck-Tiong nam-cheras,Bawa staff ambil barang di hq lama(abg nazmi)2.bawa staff hantar barang tughan(abng nazmi),3839,3889
Syafiq,Alza (VQM7753),13/07/2026,Parking,Mydin chowkit-hta-pjba,Bawa staff beli A4(ain)2.hantar staff dan klien hta(kavitha)3.hantar yasmin balik pjba(adriana),3963,4005
Syafiq,Alza (VQM7753),14/07/2026,Parking Yck-klang-segambut-taman beringin-segambut-taman beringin-segambut-klang-yck,Parking Yck-klang-segambut-taman beringin-segambut-taman beringin-segambut-klang-yck,Bawa staff ambil/hantar klien case management,4005,4241
Syafiq,Alza (VQM7753),15/07/2026,Parking,Pjba,Hantar yasmin balik pjba(syafiqah),4241,4278
Syafiq,Alza (VQM7753),16/07/2026,Parking,Mahsa avenue,Hantar yasmin mahsa avenue(syafiqah),4278,4310
Syafiq,Alza (VQM7753),16/07/2026,Parking,Masjid india-mahsa avenue-yci,Bawa staff ambil reset(kavitha)hantar yasmin mahsa avenue(syafiqah),4278,4310
Syafiq,Alza (VQM7753),20/07/2026,Parking,Mydin kota raya-spm,"Bawa staff beli barang mydin kota raya,spm(ain)",4310,4326
Aziz,Alza (VQM7753),21/07/2026,YCK,"JM Balloon Shop, Taman Melawati",Beli barang untuk birthday sabtu ni.,4329,4354
SITI NUR ATHIRAH,Alza (VQM7753),22/07/2026,YCK,"KONDOMINIUM SRI ANGSANA HILIR, JALAN HILIR 3, TAMAN SRI ANGSANA HILIR, KUALA LUMPUR",HOMEVISIT RUMAH KLIEN,4354,4378
Bell,Alza (VQM7753),23/07/2026,YCK,Puncak Alam dan Chow Kit ,Collect popcorn dan beli barang birthday party,4378,4475
Bell,Alza (VQM7753),24/07/2026,YCK,Secret Recipe Sogo,Collect cake,4475,4478
Syafiq,Alza (VQM7753),27/07/2026,Parking,Klang-shah alam-yck-hkl-pjba,Bawa staff staff pergi klang dan hospital shah alam(kavitha)2.ambil staff dan klien hantar balik pjba(syafiqah),4478,4607
Syafiq,Alza (VQM7753),29/07/2026,Parking,Pjba-cheras,Hantar yasmin balik pjba(syafiqah)2.bawa staff home visit(yaya),4607,4674
Syafiq,Alza (VQM7753),31/07/2026,Parking,Sentul-cheras,Bawa staff beli susu dan hantar pada klien(abng nazmi),4674,4745
Yatimi,Alza (VQM7753),01/08/2026,YCK,Damansara Performance Art Centre (DPAC),Escort program persembahan tarian tradisional india,4745,4773
Mohd saiful azuan bin tajul ariffin ,Alza (VQM7753),05/08/2026,Parking kereta,"Pjab, sri gombak","Bawak staff Pjba ke rumah client bg brang groceries di sri gombak, bawak yasmin balik ke Pjba ",4865,4958
Syafiq,Alza (VQM7753),04/08/2026,Parking,Pjba-sg buloh-kubu gajah-pjba-yck,Ambil/hantar staff dan bawa pergi home visit,4773,4865
Mohd saiful azuan bin tajul ariffin ,Alza (VQM7753),06/08/2026,Parking kereta ,"Hospital putrajaya, pjba","Bawak staff ke hospital putrajaya bayar bil, bawak yasmin balik ke Pjba ",4958,5070
Syafiq,Alza (VQM7753),07/08/2026,Parking,Bukit bintang-mydin-pjba,"Bawa staff pergi beli barang,lowyat dan mydin kota raya(tirah)2.hantar yasmin balik pjba(syafiqah)",5070,5122
Syafiq,Alza (VQM7753),09/08/2026,Parking,Spm-yck-jalan tombo,Bawa staff ambil roti(syikin)2.bawa staff dan klien ke klinik(kak hasini),5122,5127
Mohd saiful azuan bin tajul ariffin ,Alza (VQM7753),11/08/2026,Parking kereta,"Q mal, pjba","Bawak staff ke Q mall ambil kfc, bawak yasmin balik ke Pjba ",5127,5201
Syafiq,Alza (VQM7753),10/08/2026,Parking,Spm-jalan raja bot-pjba,Bawa staff beli kek dan ambil nasi(ain),5127,5169
Syafiq,Alza (VQM7753),13/08/2026,Parking,Sentul-seri kembangan-pasar borong-pjba,Bawa staff beli barang dan hantar cheras(nazmi)2.bawa staff beli barang wan lee heng(ain)3.hantar yasmin balik pjba(syafiqah),5201,5310
Mohd saiful azuan bin tajul ariffin ,Alza (VQM7753),14/08/2026,Parking kereta,Ampang point ,Bawak staff ke ampang point setelkn urusan,5310,5329
Mohd saiful azuan bin tajul ariffin ,Alza (VQM7753),19/08/2026,Parking kereta ,"Utc sentul, pjba","Bawah staff dan client ke UTC sentul selesaikn, bawak yasmin balik ke Pjba ",5471,5513
Syafiq,Alza (VQM7753),18/08/2026,Parking,Utc sentul-hospital selayang-hkl,Bawa staff dan klien utc sentul sentul(nazmi)2.ambil staff dekat hospital selayang(kavitha)3.bawa staff pergi hkl(nazmi),5406,5471
Aziz,Alza (VQM7753),20/08/2026,YCK,GIANT SETAPAK,Beli barang untuk retreat YCK,5513,5536
Syafiq,Alza (VQM7753),21/08/2026,Parking,Yck-pjba—jenjarom-cheras-mall cheras-flat taman kota cheras-yck-pjba-yck,Ambil/hantar-staff bawa staff hantar grocery dekat klien-dan ambil yasmin dan hantar balik pjba(syafiqah),5536,5721
Syafiq,Alza (VQM7753),22/08/2026,Parking,Yck-kajang-yck-spm,Bawa staff case management(nazmi)2.bawa staff beli barang(kak ira),5721,5785
Mohd saiful azuan bin tajul ariffin ,Alza (VQM7753),28/08/2026,Parking kereta,Pjba,Bawah yasmin balik ke Pjba ,5785,5819
Syafiq,Alza (VQM7753),06/09/2026,Parking,99 chowkit-hq lama-cheras,"Beli,ambil barang dan hantar pada klien(nazmi)",5826,5858
Syafiq,Alza (VQM7753),07/09/2026,Parking,Hq lama-batu cave-yck-kedai borong ,"Ambil barang dekat hq lama,hantar dekat klien(atirah)2.bawa staff beli barang pantry(ain)",5858,5891
Syafiq,Alza (VQM7753),10/09/2026,Parking,Yck-hq lama-farmasi sentul-cheras-yck-jinjang,"Bawa staff ambil barang hq lama,beli barang barang dan hantar pada klien(nazmi)2.bawa staff case management(kavitha)",5891,5987
Syafiq,Alza (VQM7753),11/09/2026,Parking,Spm-pasar chowkit,Bawa staff beli kek dan ais batu(ain),5987,5992
Mohd saiful azuan bin tajul ariffin ,Alza (VQM7753),15/09/2026,Parking kereta ,Berjaya times square ,Bawak staff ke berjaya times square ambil roti ,5992,6007
Bell,Alza (VQM7753),17/09/2026,YCK,"JCPAC, Sunway Square Mall",Setup booth and rehearsal 3 Days in Chow Kit Road ,6007,6060
Syafiq,Alza (VQM7753),18/09/2026,Parking,Quill mall,Bawa staff ambil kfc,6060,6062
Bell ,Alza (VQM7753),18/09/2026,YCK,"JCPAC, Sunway ",3 Days in Chow Kit Road Show,6062,6109
Syafiq,Alza (VQM7753),20/09/2026,Parking,Spm-jalan miri jinjang,Bawa staff ambil roti(syikin)2.bawa staff case management(kavita),6109,6137
Bell ,Alza (VQM7753),20/09/2026,YCK,"JCPAC, Sunway Square ",3 Days in Chow Kit Road Show,6137,6186
Syafiq,Alza (VQM7753),21/09/2026,Parking,Pjba-ampang-pjba-yck ,1.ambil staff bawa pergi ampang case management(syafiqah),6186,6267
Bell,Alza (VQM7753),22/09/2026,YCK,BTS,Collect roti,6267,6279
Syafiq,Alza (VQM7753),25/09/2026,Parking,Pjba baru,Hantar sw ke pjba(kak hasini),6279,6309
Mohd saiful azuan bin tajul ariffin ,Alza (VQM7753),25/09/2026,Parking kereta ,Seksyen 14 Petaling jaya,Ambik staff di pjba bawah balik ke hq,6309,6337
Bell ,Alza (VQM7753),28/09/2026,YCK,"UTM, KL",Event MJII,6337,6346
Syafiq,Alza (VQM7753),05/10/2026,Parking,Kedai borong-cowboy-spm,Bawa staff beli barang pantry dan kek(ain),6346,6362
Syafiq,Hiace(WXY6156),06/01/2026,Yck,Yck,"1.bawa staff ambil brng,mutiara damansara(tirah)2.hantar staff sk batu muda(nazmi)3.hantar staff sk kg baru(hasini)4.bawa staff hospital selayang(nazmi)",145118,145186
Aziz,Hiace(WXY6156),07/01/2026,YCK,"Perodua Taman Wahyu, Selayang - YCK","Bawa Syarul, Tiey, Zai survey kereta",145186,145204
Syafiq,Hiace(WXY6156),09/01/2026,Yck,Yck,1.bawa remaja dan staff training bola-koperasi polis-sklh bukit bintang pj(timie),145204,145249
Syafiq,Hiace(WXY6156),10/01/2026,Yck,Yck,1.bawa staff dan remaja latihan bola-koperasi polis-sk bukit bintang-lrt pwtc(nazmi),145249,145299
Syafiq,Hiace(WXY6156),11/01/2026,Yck,Yck,1.ambil roti(ashikin)2.bawa staff-ppr kg baru-klinik-yck(nazmi),145299,145322
Syafiq,Hiace(WXY6156),12/01/2026,Yck,Yck,1.bawa staff-spm(belle)2.bawak staff-beli barang(timi)3.hantar staff balik pj(aimi),145322,145362
Syafiq,Hiace(WXY6156),13/01/2026,Yck,Yck,1.hantar/ambil ke hq lama(kavitha)2.bawa staff quill mall(syikin)3.hantar/ambil staff hkl(miss kala)4.bawa staff jpn jaln duta(kak hasini),145362,145389
Syafiq,Hiace(WXY6156),14/01/2026,Yck,Yck,1.bawa staff-kampung baru ampang(yaya),145389,145412
Syafiq,Hiace(WXY6156),15/01/2026,Yck,Yck,1.bawa staff-smk sri rampai(nazmi)2.bawa staff pergi pemborong(kak baiti),145434,145412
Syafiq,Hiace(WXY6156),16/01/2026,Yck,Yck,1.rebung,145434,145444
Syafiq,Hiace(WXY6156),17/01/2026,Yck,Yck,"1.ambil staff dan remaja,cooking class(timi)2.ambil staff dan remaja-iwk(feroz)3.bawa staff-beli baju sklh(kavitha)3.hantar/ambil staff-Hta(kavitha)",145444,145516
Syafiq,Hiace(WXY6156),19/01/2026,Yck,Yck,1.bawa staff-AA pharmacy bangsar-cheras(nazmi)2.bawa staff-beli brng sklh(nazmi),145516,145606
Aziz,Hiace(WXY6156),21/01/2026,YCK,"IWK, Cheras, Bandar Tun Razak, Selayang, Sentul, Chow Kit","Hantar remaja teater, hantar remaja ke rumah masing masing",145621,145696
Aziz,Hiace(WXY6156),22/01/2026,YCK,"IWK, Cheras, Bandar Tun Razak, Selayang, Sentul, Chow Kit","Hantar remaja teater, hantar remaja ke rumah masing masing",145696,145770
Syafiq,Hiace(WXY6156),20/01/2026,Yck,Yck,1.ulang alik 3kali-pemborong-hq lama(kavitha)2.bawa staff hta(kavitha),145606,145621
Syafiq,Hiace(WXY6156),23/01/2026,Yck,Yck,1.bawa staff-sk kg baru(kak hasini)2.rebung,145771,145784
Syafiq,Hiace(WXY6156),24/01/2026,Yck,Yck,Hantar/ambil-remaja dan staff(timie),145853,145908
Syafiq,Hiace(WXY6156),25/01/2026,Yck,Yck,Ambil roti spm(syikin),145908,145911
Aziz,Hiace(WXY6156),23/01/2026,YCK,"IWK, Cheras, Bandar Tun Razak, Selayang, Chow Kit","Hantar remaja Teater, hantar remaja ke rumah masing masing",145784,145853
Syafiq,Hiace(WXY6156),26/01/2026,Yck,Yck,Bawa-training bola(timi),145911,145946
Syafiq,Hiace(WXY6156),27/01/2026,Yck,Yck,1.klang(yaya),145946,146038
Syafiq,Hiace(WXY6156),28/01/2026,Yck,Yck,1.bawa staff-pjba-gombak(ika),146038,146127
Syafiq,Hiace(WXY6156),29/01/2026,Yck,Yck,1.bawa staff hantar stoma bag(kavitha),146127,146154
Zai,Hiace(WXY6156),30/01/2026,Yck,Smk L bukit bintang ,Training football ,146243,146270
Zai,Hiace(WXY6156),31/01/2026,Yck,"Smk L bukit bintang, pusat kreatif kanak kanak tengku bainun (TTDI)","Training football , young chef cooking class",146270,146361
Zai,Hiace(WXY6156),05/02/2026,Yck,"Tiong nam, ppr beringin",Ambik n hantar barang ,146361,146389
Syafiq,Hiace(WXY6156),06/02/2026,Yck,Yck,1.bawa staff pergi hta(abng nazmi),146389,146392
Zai,Hiace(WXY6156),06/02/2026,Yck,Smk L bukit bintang ,Football training,146392,146420
Syafiq,Hiace(WXY6156),08/02/2026,Yck,Yck,"Hantar/ambil-staff dan remaja,arkworld(syikin)2ambil roti spm(timi)",146420,146480
Syafiq,Hiace(WXY6156),09/02/2026,Yck,Yck,1.bawa kanak2 dan staff-training bola(timi),146480,146511
Syafiq,Hiace(WXY6156),11/02/2026,Yck,Yck,1.bawa staff klinik rakyat(abg nazmi),146511,146540
Syafiq,Hiace(WXY6156),12/02/2026,Yck,Papa van,1.bawa staff-aa pharmacy-cheras(nAbg nazmi)2.hantar van-papavan,146540,146620
Syafiq,Hiace(WXY6156),10/03/2026,Yck,Shah alam-hq lama,"1,bawa staff pergi tapeme(kak hasini)",146650,146735
Syafiq,Hiace(WXY6156),12/03/2026,Yck,Jpn putrajaya-shelter visitation-pjba,1.bawa staff-dan klien pergi putrajaya(abg nazmi)2.bawa staff pergi klang(yaya)3hantar yasmin balik(aimi),146735,146966
Syafiq,Hiace(WXY6156),13/03/2026,Yck,1.danau kota-bukit kiara resort,Bawa van pasang tinted.2.bawa remaja berbuka puasa(belle),146966,147006
Khai ,Hiace(WXY6156),15/03/2026,Parking yck,Spm,Bawa staff ambil roti ( yatimi ),147006,147012
Syafiq,Hiace(WXY6156),16/03/2026,Yck,Pjba-hkl-mydin chowkit-pjba,1.ambil hantar yasmin(syafiqah)2.grocery 3hantar grocery pjba(syafiqah),147012,147088
Khai,Hiace(WXY6156),17/03/2026,Parking yck,1 pjba 2 lawatan di sekolah 3 hantar barang groceries ke gombak (syafika) 4  hantar barang dapur client (kavita),"Hantar staff, hantar barang groceries , hantar barang dapur",147089,147224
Khai,Hiace(WXY6156),18/03/2026,Parking yck,1 Taman wilayah selayang,Menghantar stoma beg client (kavitha),147224,147253
Khai,Hiace(WXY6156),19/03/2026,Parking yck,1 Pjba 2 Pjba,"Ambil 2  staff Pergi centre 8 orang remaja amek baju raya(maggie, shafika)",147254,147372
Khai,Hiace(WXY6156),27/03/2026,Parking,1- AA pharmacy bangsar 2- Tunghan machinery cheras kajang ( Nazmi) 3- restoran rebong 4- yck,"Pharmacy ambil ubat dan hantar , restoran rebong bawa kanak2 makan",147372,147442
Khai,Hiace(WXY6156),28/03/2026,Parking ,1-petaling jaya bukit bintang boy footballs training 2-pjba 3- pandan indah 4-pjba 5- yck,1-Footballs training (nazmi/yatimi) 2- supervised visid yasmin (syafika),14372,14576
Khai,Hiace(WXY6156),29/03/2026,Parking ,Sunway putra mall,Ambil roti (yatimi),147577,147582
Syafiq,Hiace(WXY6156),31/03/2026,Parking,Bukit kiara-pjba,Bawa staff-bukit kiara(belle)2.hantar yasmin(syafiqah),147582,147641
Khai,Hiace(WXY6156),01/04/2026,Parking,1-Pjba 2 pj sea park 3- Banting Jejarum 4- cheras 5- batu 9 cheras 6- yck amek yasmin 7- Pjba 8- Yck parking,1-Amek staff pjba 2- Hantar barang groceries 3- ke 4 location 5- bawak blk staff balik ke Pjba,147641,147855
Khai,Hiace(WXY6156),02/04/2026,Parking,1- Pjba 2- sungai besi Condominium 3- yck 4- Pjba,"Mengambil staff & remaja dr pjba hantar ke rumah sewa, mengambil yasmin & menghantar yasmin ke pjba & staff  ",147854,147972
Syafiq,Hiace(WXY6156),04/04/2026,Parking,Bukit bintang boys-pwtc,Bawa staff dan remaja training bola(abg nazmi)2.bawa staff dan remaja topp touch n go(abg nazmi),147973,148004
Khai,Hiace(WXY6156),06/04/2026,Parking,Jalan cerapu cheras (yaya),Hantar staff ke Jalan Cheras amek resit( yaya),148005,148027
Khai,Hiace(WXY6156),07/04/2026,Parking ,Putrajaya (Nazmi),JABATAN PENDIDIKAN MALAYSIAN ,148027,148103
Syafiq,Hiace(WXY6156),09/04/2026,Parking,Pj,Hantar yasmin balik pjba(adriana),148103,148139
Khai,Hiace(WXY6156),10/04/2026,Parking,1- Restaurant Rebong bukit Aman,1- Restaurant Rebong bawak kanak2 dan 2 staff yck,148139,148163
Khai,Hiace(WXY6156),11/04/2026,Parking,Petaling jaya bukit bintang ,Training footballs (Nazmi),148163,148192
Khai,Hiace(WXY6156),12/04/2026,Parking,Sunway putra Mall,Mengambil Roti (Yatimi),148203,148230
Syafiq,Hiace(WXY6156),13/04/2026,Parking,Hkl-pjba-pj,"Hantar staff dan remaja balik pjba(syafiqah)2.bawa staff,remaj training bola(syikin)",148251,148316
Khai,Hiace(WXY6156),15/04/2026,Parking van,1- Pjba 2- Pjba,Mengambil 1 remaja bawak ke centre & Menghantar pulang ke pjba,148345,148419
Khai,Hiace(WXY6156),16/04/2026,Parking van ,Pjba,Mengambil jasmine ,148420,148450
Mohd saiful azuan bin tajul ariffin ,Hiace(WXY6156),17/04/2026,Parking van,Parking van,Bawak budak main bola,148450,148478
Syafiq,Hiace(WXY6156),18/04/2026,Parking,Pj,Bawa remaja dan staff training bola(abng nazmi),148478,148507
Mohd saiful azuan bin tajul ariffin ,Hiace(WXY6156),21/04/2026,Paking van,Petaling jaya,Ambil yasmin Bawak ke masha avenue ,148516,148541
Syafiq,Hiace(WXY6156),20/04/2026,Parking,Titiwangsa,Bawa kanak2-main bola(timi),148507,148516
Syafi,Hiace(WXY6156),24/04/2026,Parking,Jalan tanglin,Rebung,148541,148552
Mohd saiful azuan bin tajul ariffin ,Hiace(WXY6156),29/04/2026,Parking van,"Chow Kit, putrajaya, bukit beruntung, pj","Bawak staff ke kedai lampu Chow Kit, Bawak staff ke JPN putrajaya, Bawak staff ke bukit beruntung beli brang dapur client, Bawak balik yasmin ke pj",148590,148831
Syafiq,Hiace(WXY6156),28/04/2026,Parking,1.mydin-pjba,Grocery mydin 2.hantar yasmin balik,148552,148590
Mohd saiful azuan bin tajul ariffin ,Hiace(WXY6156),05/05/2026,Parking van ,Setapak,Hantar van Cam ke x carsom,148832,148857
Mohd saiful azuan bin tajul ariffin ,Hiace(WXY6156),12/05/2026,Parking van,"Sentul, ampang, seri kembangan ","Bawak staff beli brang utk client di sentul, ampang dan seri kembang",148872,148969
Syafiq,Hiace(WXY6156),12/05/2026,Parking ,Pjba,Hantar yasmin balik pjba(syafiqah),148969,149004
Mohd saiful azuan bin tajul ariffin ,Hiace(WXY6156),13/05/2026,Parking van ,Serdang. Pj,Bawak staff ke hospital serdang bg brang pada Client (yaya) Bawak yasmin blik ke pj,149004,149117
Mohd saiful azuan bin tajul ariffin ,Hiace(WXY6156),14/05/2026,Parking  van ,Pj,Bawak yasmin blik ke Pjba ,149117,149155
Mohd saiful azuan bin tajul ariffin ,Hiace(WXY6156),15/05/2026,Parking van,Ampang. Pj,"Bawak staff ke ampang bt home visit client, bawak yasmin balij ke Pjba ",149157,149225
Syafiq,Hiace(WXY6156),18/05/2026,Parking,1.cheras-pjba-bukit bintang ,1.bawa staff homevisit(tirah)2.hantar yasmin balik pjba(syafiqah)3.bawa kanak-kanak main bola(timi),149225,149302
Syafiq,Hiace(WXY6156),19/05/2026,Parking,1.mydin chowkit-pjba,1.ambil barang grocery(kavitha)2.hantar yasmin balik pjba(syafiqah),149302,149339
Syafiq,Hiace(WXY6156),20/05/2026,Parking,1.jalan chan sow lin-yck-pjba,Ambil coklat(miss kala)2.hantar yasmin balik pjba(syafiqah),149339,149390
Syafiq,Hiace(WXY6156),21/05/2026,Parking,Jalan raja laut-pjba,1.hantar/ambil-staff outreach program(kak hasini)2.hantar yasmin balik pjba(syafiqah),149390,149429
Syafiq,Hiace(WXY6156),22/05/2026,Parking,Bukit sentosa-setapak,"Bawa staff,hantar barang(kak ira)2.servey bengkel",149430,149523
Mohd saiful azuan bin tajul ariffin ,Hiace(WXY6156),24/05/2026,Paking van ,"Sunway putra mall, ampang, mydin chowkit","Bawak staff ambik roti di sunway putra mall, Bawak staff ke kedai perabut beli brang client di ampang dan mydin Chow kit",149523,149553
Syafiq,Hiace(WXY6156),25/05/2026,Parking,Pj ,Bawa kanak2 dan staff training bola(belle),149553,149581
Mohd saiful azuan bin tajul ariffin ,Hiace(WXY6156),26/05/2026,Parking van,"Shah alam, pj","Bawak staff ke shah alam ambil laptop, Bawak staff Pjba ke jlan tun razak",149581,149720
Syafiq,Hiace(WXY6156),02/06/2026,Parking,Stadium merdeka-mydin chowkit,Bawa remaja dan staff pergi stadium merdeka(syikin)2.bawa staff beli roti(syikin),149720,149741
Mohd saiful azuan bin tajul ariffin ,Hiace(WXY6156),05/06/2026,Parking van,"Kenangan mall, restoren rebung","Bawak staff g kenangan mall beli brang.,Bawak staff dan kanak2 ke restaurant rebung ",149743,149765
Mohd saiful azuan bin tajul ariffin ,Hiace(WXY6156),08/06/2026,Parking van ,"Pj, parlimen","Bawak blik yasmin ke Pjba, Bawak balik staff dr parlimen",149807,149843
Syafiq,Hiace(WXY6156),08/06/2026,Parking,Parlimen-bengkel-yck,Hantar staff dan remaja(belle)2.hantar van foton dan ambil staff(abng saiful),149765,149807
Mohd saiful azuan bin tajul ariffin ,Hiace(WXY6156),09/06/2026,Parking van,"Parlimen, berjaya times square, ampang ","Bawak staff dan pelajar ke parlimen, Bawak staff ke berjaya times square ambil roti, bawah staff ke ampang case management ",149843,149895
Mohd saiful azuan bin tajul ariffin ,Hiace(WXY6156),10/06/2026,Parking van,"Bangi, pj","Bawak staff ke bangi bg susu lt client, bawak yasmin balik ke Pjba ",149944,150069
Mohd saiful azuan bin tajul ariffin ,Hiace(WXY6156),11/06/2026,Parking van,"Banting, klang, pj",Bawak staff ke banting dan klang bg brang groceries pada Client ,150068,150245
Syafiq,Hiace(WXY6156),09/06/2026,Parking,Pjba-parlimen-yck,Hantar yasmin balik pjba(adriana)2.ambil staff dan remaja parlimen(miss kala),149895,149944
Mohd saiful azuan bin tajul ariffin ,Hiace(WXY6156),12/06/2026,Parking van,"Mid valley, pj, restoren rebung ","Bawak staff ke mid valley beli brang, Bawak yasmin balik ke Pjba, Bawak staff dan pelajar ke restaurant rebung ",150245,150316
Mohd saiful azuan bin tajul ariffin ,Hiace(WXY6156),15/06/2026,Parking van,Seri kembangan ,Bawak staff ambik brang donor di seri kembangan ,150316,150377
Mohd saiful azuan bin tajul ariffin ,Hiace(WXY6156),19/06/2026,Parking van,Chow kit (yoga) restaurant rebung,"Bawak staff ke pusat yoga, Bawak staff dan pelajar ke restaurant rebung ",150377,150395
Mohd saiful azuan bin tajul ariffin ,Hiace(WXY6156),20/06/2026,Parking van,W badminton senter sentul,Bawak staff dan pelajar main badminton di W senter sentul,150395,150406
Mohd saiful azuan bin tajul ariffin ,Hiace(WXY6156),21/06/2026,arking van,"Sunway putra mall, pj","Bawak staff ambik roti di sunway putra mall, Bawak balik yasmin ke Pjba ",150406,150444
Mohd saiful azuan bin tajul ariffin ,Hiace(WXY6156),22/06/2026,Parking van,Tasik titiwangsa ,Bawak staff dan pelajar ke tasik titiwangsa ,150444,150463
Mohd saiful azuan bin tajul ariffin ,Hiace(WXY6156),23/06/2026,Parking van,Selayang ,Bawak staff dan client ke kolej kominiti selayang,150463,150504
Mohd saiful azuan bin tajul ariffin ,Hiace(WXY6156),24/06/2026,Parking van,"Bangsar, Chow Kit, sentul","Bawak volunteer ambik brang donor di Bangsar, bawak sfaff ke balai polis Chow kit dan kedai brang, Bawak staff ke rumah client di sentul",150504,150570
Mohd saiful azuan bin tajul ariffin ,Hiace(WXY6156),25/06/2026,Parking van,Pj,Bawak yasmin blik ke Pjba ,150570,150605
Syafiq,Hiace(WXY6156),26/06/2026,Parking,Jalan kamunting,Hantar/ambil staff yoga(cikgu fiza),150605,150612
Mohd saiful azuan bin tajul ariffin ,Hiace(WXY6156),26/06/2026,Parking van,"Chow kit, pj","Bawak staff ke menara teo chew, bawak yasmin balik ke Pjba ",150612,150686
Syafiq,Hiace(WXY6156),29/06/2026,Parking,Mydin,Ambil staff dekat mydin(kak ira),150686,150690
Syafiq,Hiace(WXY6156),30/06/2026,Parking,Hq lama-yck-Bts-brickfields-quil mall-yck-chowkit-parking-bengkel winner,Hantar sw hq lama(kak hasini)2.bawa staff ambil roti-ayam kfc-banting(syikin)ulang alik bengkel van foton,150690,150721
Syafiq,Hiace(WXY6156),01/07/2026,Parking,Gombak-spm,Bawa staff ambil aiskrim(syikin)2.bawa syaff ambil kek(ain),150721,150742
Syafiq,Hiace(WXY6156),06/07/2026,Parking,Mydin chowkit-hkl-pjba,Ambil staff dekat mydin chowkit(kak ira)2.ambil staff dan klien hantar balik pjba(syafiqah),150742,150783
Mohd saiful azuan bin tajul ariffin ,Hiace(WXY6156),07/07/2026,Parking van,"Menara teo chew(chow kit), Petaling jaya","Bawak staff dan client ke JPN chow kit, hantar clients ke Petaling jaya",150783,150815
Mohd saiful azuan bin tajul ariffin ,Hiace(WXY6156),08/07/2026,Parking van,"Sentul, pj","Bawak staff ke sekolah sentul utama, Bawak yasmin blik ke Pjba ",150818,150871
Mohd saiful azuan bin tajul ariffin ,Hiace(WXY6156),09/07/2026,Parking van,"Damansara, hartamas, Pjba ","Bawak staff dan pelajar ke damansara wisma E&C, Bawak staff dan client ke JPN hartamas hantar dokumen, Bawak yasmin blik ke Pjba ",150871,150953
Syafiq,Hiace(WXY6156),07/07/2026,Parking,Menara rkt,Bawa staff dan klien menara rkt(kak ira),150815,150818
Syafiq,Hiace(WXY6156),11/07/2026,Parking,Taman botani-wan lee heng,Bawa staff dan remaja pergi taman botani(syikin)2.bawa staff beli barang(kak pika),150953,150969
Syafiq,Hiace(WXY6156),12/07/2026,Parking,Spm-kl gate way,Bawa staff ambil roti(syikin)2.bawa staff dan remaja fashion show(timi),150969,151015
Mohd saiful azuan bin tajul ariffin ,Hiace(WXY6156),13/07/2026,Parking van ,"Q mall, hkl","Bawak staff dan pelajar ke Q mall beli brang, ambik staff dan pelajar dr hospital ampuan azizah",151015,151026
Mohd saiful azuan bin tajul ariffin ,Hiace(WXY6156),14/07/2026,Parking van,"Q mall, berjaya times square, pjba","Bawak staff ambik roti di berjaya times square dab ambil KFC di Q mall, Bawak balik yasmin ke Pjba ",151026,151073
Mohd saiful azuan bin tajul ariffin ,Hiace(WXY6156),17/07/2026,Parking van,Pjba,Bawak yasmin blik ke Pjba ,151073,151107
Mohd saiful azuan bin tajul ariffin ,Hiace(WXY6156),18/07/2026,Parking van,Pjba,Bawak staff dan kanak2 pjba ke hq ad program KPJ,151107,151183
Syafiq,Hiace(WXY6156),20/07/2026,Parking,Wan lee heng-titiwangsa-hkl-pjba,Bawa staff beli barang(feroz)hantar kanak2 main bola(timi) ambil staff dan klien dekat hkl dan hantar balik pjba(syafiqah),151183,151228
Syafiq,Hiace(WXY6156),21/07/2026,Parking,Hq lama-chowkit-pjba,Hantar sw dekat hq lama(kak hasini)2.bawa kereta dan van basuh3hantar yasmin balik pjba(syafiqahh,151228,151270
Mohd saiful azuan bin tajul ariffin ,Hiace(WXY6156),21/07/2026,Parking van,"Jalan tiong nam, HKL","Ambik staff dt hq lama tiong nam, Bawak staff dan client ke HKL",151270,151276
Mohd saiful azuan bin tajul ariffin ,Hiace(WXY6156),22/07/2026,Parking van,"Pjba, subang jaya, cheras, klang ","Bawak staff Pjba ke rumah client bg brang groceries (pj, subang, cheras, klang) ",151276,151481
Mohd saiful azuan bin tajul ariffin ,Hiace(WXY6156),23/07/2026,Parking van,"JPN, Q mall, pjba","Bawak staff dan client ke JPN putrajaya, Bawak staff dan pelajar ke Q mall beli brang, bawak balij yasmin ke Pjba ",151481,151601
Syafiq,Hiace(WXY6156),24/07/2026,Parking,Yck-Sri kembangan-aloeva pharmacy,Bawa staff beli susu dan hantar dekat klien(abng nazmi),151601,151680
Syafiq,Hiace(WXY6156),25/07/2026,Parking,Pjba-yck-pjba-yck jalan tiong nam-yck-jalan tiong nam,Ambil/hantar-staff dan remaja pjba ke yck(mr.gopal)2.ambil hantar staff dan kanak2 ke klinik (kak ira),151680,151755
Mohd saiful azuan bin tajul ariffin ,Hiace(WXY6156),27/07/2026,Parking van ,"Pasaraya wan kee heng Chow kit, Q mall Chow kit","Bawak staff ke pasar raya beli brang, bawah staff ke Q mall beli brang ",151755,151762
Syafiq,Hiace(WXY6156),28/07/2026,Parking,Hq lama-quill mall,"Hantar sw ke hq lama,grocery(atirah)2bawa staff ambil kfc",151762,151767
Mohd saiful azuan bin tajul ariffin ,Hiace(WXY6156),28/07/2026,Parking van ,"Pjba, tiong nam","Bawak yasmin blik ke Pjba, Bawak staff balik ke hq",151767,151803
Mohd saiful azuan bin tajul ariffin ,Hiace(WXY6156),31/07/2026,Parking van,Pjba ,Bawak yasmin blik ke Pjba ,151803,151836
Mohd saiful azuan bin tajul ariffin ,Hiace(WXY6156),03/08/2026,Parking van,Pjba,Bawak yasmin blik ke Pjba ,151836,151873
Mohd saiful azuan bin tajul ariffin ,Hiace(WXY6156),04/08/2026,Parking van,"Hkl, Banggunan mara, Pjba","Bawak staff dan client ke hkl setelkn urusan, Bawak staff dan client ke banggunan mara, bawah yasmin balik ke Pjba ",151873,151923
Mohd saiful azuan bin tajul ariffin ,Hiace(WXY6156),07/08/2026,Parking van,Shah alam,Bawak staff ke kedai baju printing di shah alam,151923,151995
Syafiq,Hiace(WXY6156),08/08/2026,Parking,Chowkit,Bawa staff beli barang wan lee heng,151995,152001
Mohd saiful azuan bin tajul ariffin ,Hiace(WXY6156),10/08/2026,Parking van,Klang,"Bawak staff ke klang, ambil client bawak ke Chow Kit ",152001,152091
Syafiq,Hiace(WXY6156),11/08/2026,Parking,Yck-kedutaan indonesia-yck-quill mall-kedutaan indonesia-yck-kedutaan indonesia-medan mara-kedutaan indonesia-yck-hq lama-klang,1.hantar staff dan klien pergi kedutaan indonesia(yaya)2.bawa staff ambil kfc dekat quill mall(syikin)3.ambil staff dan klien(kak ira)4.ambil staff dan klien bawa pergi persuruh jaya sumpah-kedutaan indonesia-yck-hq lama dan hantar klien balik shelter klang(yaya),152091,152246
Syafiq,Hiace(WXY6156),12/08/2026,Parking,Setapak-pjba-ampang,Bawa staff ambil reset(atirah)2.hantar yasmin balik pjba(syafiqah)3.bawa staff pergi ampang case management(kavitha),152246,152327
Syafiq,Hiace(WXY6156),14/08/2026,Parking,Pjba-ss15 subang-flora damansara-ss19pj-pjba-yck,Ambil/hantar-staff dan hantar grocery pada klien(addriana,152327,152401
Mohd saiful azuan bin tajul ariffin ,Hiace(WXY6156),14/08/2026,Parking van,Pjba,Bawah yasmin balik ke Pjba ,152401,152434
Mohd saiful azuan bin tajul ariffin ,Hiace(WXY6156),15/08/2026,Parking van,Kepong,Bawak staff ke ppr beringin kepong bt case management ,152434,152459
Mohd saiful azuan bin tajul ariffin ,Hiace(WXY6156),16/08/2026,Parking van,"Sunway putra mall, jalan thamboosamy","Bawak staff ke sunway putra mall ambil roti, bawah staff dan client ke klinik jalan thamboosamy",152459,152464
Syafiq,Hiace(WXY6156),17/08/2026,Parking,Hulu langat,Visit tempt camp site-ubipadi leasure,5329,5406
Syafiq,Hiace(WXY6156),17/08/2026,Parking,Titiwangsa,Bawa kanak2 dan main bola,152464,152473
Mohd saiful azuan bin tajul ariffin ,Hiace(WXY6156),18/08/2026,Parking van,"Q mall, berjaya times square, pjba ampang","Bawak staff ke Q mall dan berjaya times square ambil makanan kfc dan roti, bawah hq dan staff pjba g rumah client di ampang(case management) ",152473,152572
Mohd saiful azuan bin tajul ariffin ,Hiace(WXY6156),20/08/2026,Parking van,"Selayang, Q mall, pjab","Bawak staff ke taman wilayah selayang, rumah client (case management) Bawak staff ke Q mall ambil brang, bawah yasmin balik ke Pjba ",152572,152647
Syafiq,Hiace(WXY6156),26/08/2026,parking,Hq lama-mydin chowkit-pjba,Hantar staff pergi hq lama(tirah)2.hantar/ambil staff beli barang(yaya)3.hantar yasmin balik pjba(syafiqah),152647,152685
Syafiq,Hiace(WXY6156),27/08/2026,Parking,Jalan ipoh-yck-jalan ipoh-chan sowlin-yck,Hantar/ambil sw smk P outreach(yaya)2.bawa staff ambil barang dekat the loost food(timi),152685,152724
Mohd saiful azuan bin tajul ariffin ,Hiace(WXY6156),28/08/2026,Parking van ,"Smk sentul, hospital cheras ","Bawak staff ke sekolah sentul utama ad meeting, Bawak staff ke hospital cheras bt bayaran bil",152724,152761
Syafiq,Hiace(WXY6156),28/08/2026,Parking,Rebung,Bawa staff dan kanak2 pergi rebung,152761,152771
Mohd saiful azuan bin tajul ariffin ,Hiace(WXY6156),30/08/2026,Parking van,"Sunway putra mall, pasaraya wan lee, mydin cheras ","Bawak staff ke sunway putra mall ambil roti, bawah staff ke pasar raya wan lee beli brang, bawak sfaff ke my beli brang dapur client ",152771,152810
Mohd saiful azuan bin tajul ariffin ,Hiace(WXY6156),02/09/2026,Parking van ,"Pjba, pandan jaya, ppr beringin kepong ","Bawak staff Pjba ke rumah client di pandan jaya, Bawak staff ke rumah client case management ",152810,152927
Mohd saiful azuan bin tajul ariffin ,Hiace(WXY6156),03/09/2026,Parking van,"Shah alam, jalan pahang, bukit beruntung ","Bawak staff ke makamah petaling shah alam. Bawak staff ke jalan pahang beli brang, bawak sfaff ke bukit beruntung beli brang dapur client ",152927,153122
Mohd saiful azuan bin tajul ariffin s,Hiace(WXY6156),05/09/2026,Parking van,Bawak semau staff ke retreat kt baytang kali,Bawak staff dan pelajar pjba ke batang kali,152927,153312
Mohd saiful azuan bin tajul ariffin,Hiace(WXY6156),08/09/2026,Parking van3,"Bawak staff ke time square ambil roti donor, Bawak staff ke Q mall ambil makanan kfc",Bawak staff dan pelajar ke berjaya times square ambil Bawak staff ke Q mall ambil brang kfcquare ambil roti ,153312,153323
Mohd saiful azuan bin tajul ariffin ,Hiace(WXY6156),08/09/2026,Parking ,Chow kit,Bawak staff dan pelajar ke pasar borong Chow kit,153323,153326
Syafiq,Hiace(WXY6156),11/09/2026,Parking,Rebung,Bawa kanak2 dan staff pergi rebung,153326,153336
Mohd saiful azuan bin tajul ariffin ,Hiace(WXY6156),12/09/2026,Parking van,Danau koto setapak,Bawak staff ke rumah client bg brang groceries dan kerusi roda,153336,153354
Mohd saiful azuan bin tajul ariffin ,Hiace(WXY6156),13/09/2026,Parking van ,Sunway putra mall ,Bawak staff ambik roti di sunway putra mall ,153354,153360
Syafiq,Hiace(WXY6156),14/09/2026,parking,Jalan ipoh-yck-jalan ipoh-yck,Hantar sw pergi jalan ipoh(nazmi)2.ambil sw balik yck(kak hasini)3.ambil sw balik yck(nazmi),153360,153414
Syafiq,Hiace(WXY6156),15/09/2026,Parking,Yck-Jalan ipoh-yck,"Ambil dan hantar sw,sekolah (P)(nazmi)",153414,153435
Mohd saiful azuan bin tajul ariffin ,Hiace(WXY6156),17/09/2026,Paking van,"Ampang, cowboys Jalan kucibg.",😅😜 ,153435,153476
Syafiq,Hiace(WXY6156),18/09/2026,Parking,Spm,Bawa staff beli susu klien(yaya),153476,153479
Syafiq,Hiace(WXY6156),19/09/2026,Parking,Yck-chowkit-yck-sunway-yck,Pergi bengke tukar tayar-hantar staff pergi sunway jacpac(syikin),153479,153527
Syafiq,Hiace(WXY6156),21/09/2026,Parking,Chowkit,Pembayaran van dekat winner tyre,153527,153529
Syafiq,Hiace(WXY6156),24/09/2026,Parking,Klang-yck-mahsa avenue-yck,Bawa staff pergi lorong renggas dan bawa home visit(yaya)2.bawa staff dan klien kaunseling,153529,153652
Mohd saiful azuan bin tajul ariffin ,Hiace(WXY6156),25/09/2026,Parking van,"Ppr beringin jinjang, kepong",Bawak staff dan client ke jabatan kebajikan masyarakat selesaikn kes ,153652,153697
Syafiq,Hiace(WXY6156),25/09/2026,Parking,Rebung,Bawa kanak2 dan staff pergi rebung,153697,153708
Mohd saiful azuan bin tajul ariffin ,Hiace(WXY6156),30/09/2026,Parking van,Ampang jaya,Bawak staff Pjba ke rumah client di ampang jaya case management ,153725,153773
Mohd saiful azuan bin tajul ariffin ,Hiace(WXY6156),01/10/2026,Parking van,Mahsa avenue petaling jaya,Bawak staff dan client ke mahsa avenue petaling jaya,153773,153799
Mohd saiful azuan bin tajul ariffin ,Hiace(WXY6156),02/10/2026,Parking van,"Sunway putra mall, mydin ",Bawak staff ke sunway putra mall dan mydin beli brang ,153799,153803
Mohd saiful azuan bin tajul ariffin ,Hiace(WXY6156),02/10/2026,Parking van,Q mall ,Bawak staff ke Q mall ambil KFC,153803,153806
Syafiq,Hiace(WXY6156),04/10/2026,Parking,Spm-mydin chowkit-quil mall-danau kota-kolej komununiti selayang-yck,Bawa staff ambil roti(syikin)2.bawa staff beli barang dan hantar pada klien(kak ira),153806,153858`;

// Parse CSV taking into account quotes
function parseCsv(text) {
  const lines = text.trim().split('\n');
  const header = lines[0];
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Regex to match CSV fields with quotes
    const fields = [];
    let current = '';
    let inQuotes = false;

    for (let c = 0; c < line.length; c++) {
      const char = line[c];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        fields.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    fields.push(current.trim());
    rows.push(fields);
  }
  return rows;
}

const rows = parseCsv(rawCsv);
console.log('Total rows parsed:', rows.length);

// ID mappings based on Supabase DB
const DRIVERS = {
  saiful: 'driver-1790821275140-qrquongiuyk',
  syafiq: 'driver-1790821320812-ur8keyyon3',
  aziz: 'user-1790820380431'
};

const VEHICLES = {
  foton: { id: 'vehicle-1790822031982-6nn6sdvd94g', name: 'FOTON', plate: 'VJQ8931' },
  alza: { id: 'vehicle-1790821959575-gjpcwjceii', name: 'ALZA', plate: 'VQM7753' },
  hiace: { id: 'vehicle-1790821917449-jjo1mk8pzj', name: 'HIACE', plate: 'WXY6156' }
};

const sqlStatements = [];
const odoRecords = [];
let index = 1;

for (const row of rows) {
  const [rawDriver, rawVan, rawDate, rawFrom, rawTo, rawPurpose, rawStartOdo, rawEndOdo] = row;

  // 1. Driver mapping
  const driverLower = (rawDriver || '').toLowerCase().trim();
  let driverId = null;
  let staffName = 'Unknown';

  if (driverLower.includes('saiful')) {
    driverId = `'${DRIVERS.saiful}'`;
    staffName = 'Saiful';
  } else if (driverLower.includes('syafiq') || driverLower.includes('syafi')) {
    driverId = `'${DRIVERS.syafiq}'`;
    staffName = 'Syafiq';
  } else if (driverLower.includes('aziz')) {
    driverId = `'${DRIVERS.aziz}'`;
    staffName = 'Aziz';
  } else {
    driverId = 'NULL';
    staffName = 'Unknown';
  }

  // 2. Vehicle mapping
  const vanLower = (rawVan || '').toLowerCase();
  let vehicleId = VEHICLES.hiace.id;
  if (vanLower.includes('foton') || vanLower.includes('vjq8931')) {
    vehicleId = VEHICLES.foton.id;
  } else if (vanLower.includes('alza') || vanLower.includes('vqm7753')) {
    vehicleId = VEHICLES.alza.id;
  } else if (vanLower.includes('hiace') || vanLower.includes('wxy6156')) {
    vehicleId = VEHICLES.hiace.id;
  }

  // 3. Date mapping (DD/MM/YYYY -> YYYY-MM-DD)
  const [d, m, y] = rawDate.split('/');
  const dateFormatted = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  const isoTimestamp = `${dateFormatted}T00:00:00.000Z`;

  // 4. Odometers
  const startOdo = parseInt(rawStartOdo, 10) || 0;
  const endOdo = parseInt(rawEndOdo, 10) || startOdo;
  let distance = endOdo - startOdo;
  if (distance < 0 || distance > 2000) {
    distance = Math.max(0, distance);
  }

  // 5. Escaped text fields for SQL
  const escapeSql = (str) => (str ? str.replace(/'/g, "''").trim() : '');
  const fromLoc = escapeSql(rawFrom || 'Parking');
  const toLoc = escapeSql(rawTo || 'HQ');
  const purpose = escapeSql(rawPurpose || 'Official Trip');
  const cleanStaffName = escapeSql(staffName);

  const id = `odo-hist-${y}${m.padStart(2, '0')}${d.padStart(2, '0')}-${String(index).padStart(4, '0')}`;
  index++;

  odoRecords.push({
    id,
    driver_id: driverId === 'NULL' ? null : driverId.replace(/'/g, ''),
    vehicle_id: vehicleId,
    date: isoTimestamp,
    odometer: endOdo,
    start_odometer: startOdo,
    distance,
    from_location: rawFrom,
    to_location: rawTo,
    purpose: rawPurpose,
    staff_name: staffName,
    tenant_id: 'yck'
  });

  sqlStatements.push(
    `INSERT INTO public.odometer_logs (id, driver_id, vehicle_id, date, start_odometer, odometer, distance, from_location, to_location, purpose, staff_name, tenant_id, created_at) ` +
    `VALUES ('${id}', ${driverId}, '${vehicleId}', '${isoTimestamp}', ${startOdo}, ${endOdo}, ${distance}, '${fromLoc}', '${toLoc}', '${purpose}', '${cleanStaffName}', 'yck', '${isoTimestamp}') ` +
    `ON CONFLICT (id) DO UPDATE SET start_odometer = EXCLUDED.start_odometer, odometer = EXCLUDED.odometer, distance = EXCLUDED.distance, purpose = EXCLUDED.purpose;`
  );
}

// Generate Vehicle Odometer update statements
const vehicleUpdates = [
  `-- Kemaskini bacaan odometer semasa kenderaan kepada bacaan trip terkini`,
  `UPDATE public.vehicles SET current_odometer = 68174 WHERE id = '${VEHICLES.foton.id}';`,
  `UPDATE public.vehicles SET current_odometer = 6362 WHERE id = '${VEHICLES.alza.id}';`,
  `UPDATE public.vehicles SET current_odometer = 153858 WHERE id = '${VEHICLES.hiace.id}';`
];

const fullSql = [
  `-- ============================================================================`,
  `-- SKRIP SQL IMPORT REKOD PERJALANAN / ODOMETER LOGS (ARMADA FLOW)`,
  `-- Total Rekod: ${sqlStatements.length} trips`,
  `-- Tenant ID: yck (Yayasan Chow Kit)`,
  `-- Pemandu berdaftar: Saiful, Syafiq, Aziz. Lain-lain: NULL / Unknown`,
  `-- ============================================================================`,
  ``,
  `BEGIN;`,
  ``,
  `-- 1. Masukkan rekod perjalanan ke dalam jadual odometer_logs`,
  ...sqlStatements,
  ``,
  ...vehicleUpdates,
  ``,
  `COMMIT;`
].join('\n');

fs.writeFileSync('historical_trips_import.sql', fullSql, 'utf8');
console.log('Saved historical_trips_import.sql successfully with', sqlStatements.length, 'records.');
