insert into datasets(id,code,name,owner,purpose,personal,review_due,max_age_hours) values
 ('10000000-0000-4000-8000-000000000001','CONTACTS','Customer contact export','Aroha','Confirm delivery details',true,current_date-3,24),
 ('10000000-0000-4000-8000-000000000002','ORDERS','Wholesale order export','Ben','Weekly order review',false,current_date+30,48),
 ('10000000-0000-4000-8000-000000000003','STOCK','Warehouse stock export','Aroha','Replenishment review',false,current_date+30,24)
 on conflict do nothing;
insert into rules(id,dataset_id,code,name,kind,field,lower_bound,upper_bound,allowed,max_failures,severity) values
 ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','C-EMAIL','Email present','missing','email',null,null,null,0,2),
 ('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','C-ID','Unique contact reference','duplicate','contact_id',null,null,null,0,3),
 ('20000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000002','O-COUNT','Order volume','row_count',null,2,10000,null,0,2),
 ('20000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000002','O-QUANTITY','Positive quantity','number_range','quantity',1,10000,null,0,2),
 ('20000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000002','O-STATUS','Recognised status','allowed','status',null,null,'["open","shipped"]',0,1),
 ('20000000-0000-4000-8000-000000000006','10000000-0000-4000-8000-000000000003','S-UPDATED','Recent stock count','freshness','updated_at',null,48,null,0,2)
 on conflict do nothing;
insert into actions(id,code,dataset_id,name,owner,due) values
 ('30000000-0000-4000-8000-000000000001','ACT-101','10000000-0000-4000-8000-000000000001','Reconcile duplicate contact references','Aroha',current_date-2),
 ('30000000-0000-4000-8000-000000000002','ACT-102','10000000-0000-4000-8000-000000000003','Confirm stock extract arrives before review','Ben',current_date+2)
 on conflict do nothing;
