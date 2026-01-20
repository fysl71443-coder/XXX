import pg from 'pg';
import dotenv from 'dotenv';
const { Pool } = pg;
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/xxx'
});

// Menu products data
const menuProducts = [
  // Appetizers - المقبلات
  { name: 'Butterfly prawn', name_en: 'Butterfly prawn', name_ar: 'ربيان فراشة', category: 'Appetizers - المقبلات', price: 41.74 },
  { name: 'Butternan', name_en: 'Butternan', name_ar: 'خبز بالزبدة', category: 'Appetizers - المقبلات', price: 3.48 },
  { name: 'Fried wanton', name_en: 'Fried wanton', name_ar: 'ونتون مقلي', category: 'Appetizers - المقبلات', price: 20.00 },
  { name: 'Fishcakes', name_en: 'Fishcakes', name_ar: 'كعك السمك', category: 'Appetizers - المقبلات', price: 4.35 },
  { name: 'Fish finger', name_en: 'Fish finger', name_ar: 'أصابع السمك', category: 'Appetizers - المقبلات', price: 30.43 },
  { name: 'French fry', name_en: 'French fry', name_ar: 'بطاطس مقلية', category: 'Appetizers - المقبلات', price: 12.17 },
  { name: 'Fried fish', name_en: 'Fried fish', name_ar: 'سمك مقلي', category: 'Appetizers - المقبلات', price: 40.00 },
  { name: 'Fried prawns', name_en: 'Fried prawns', name_ar: 'ربيان مقلي', category: 'Appetizers - المقبلات', price: 41.74 },
  { name: 'Garlic nan', name_en: 'Garlic nan', name_ar: 'خبز ثوم', category: 'Appetizers - المقبلات', price: 3.48 },
  { name: 'Gold fried prawns', name_en: 'Gold fried prawns', name_ar: 'ربيان مقلي ذهبي', category: 'Appetizers - المقبلات', price: 41.74 },
  { name: 'Hummus', name_en: 'Hummus', name_ar: 'حمص', category: 'Appetizers - المقبلات', price: 10.43 },
  { name: 'Kaichai', name_en: 'Kaichai', name_ar: 'كايساي', category: 'Appetizers - المقبلات', price: 15.65 },
  { name: 'Mixed appetizers (L)', name_en: 'Mixed appetizers (L)', name_ar: 'مقبلات مشكلة (كبيرة)', category: 'Appetizers - المقبلات', price: 34.78 },
  { name: 'Mixed appetizers (M)', name_en: 'Mixed appetizers (M)', name_ar: 'مقبلات مشكلة (متوسطة)', category: 'Appetizers - المقبلات', price: 25.22 },
  { name: 'Plain nan', name_en: 'Plain nan', name_ar: 'خبز عادي', category: 'Appetizers - المقبلات', price: 0.87 },
  { name: 'Potato chop', name_en: 'Potato chop', name_ar: 'شريحة بطاطس', category: 'Appetizers - المقبلات', price: 3.48 },
  { name: 'Prawn balls', name_en: 'Prawn balls', name_ar: 'كرات ربيان', category: 'Appetizers - المقبلات', price: 26.09 },
  { name: 'Prawn Tempura', name_en: 'Prawn Tempura', name_ar: 'ربيان تمبورا', category: 'Appetizers - المقبلات', price: 14.78 },
  { name: 'Prawn toast', name_en: 'Prawn toast', name_ar: 'توست ربيان', category: 'Appetizers - المقبلات', price: 24.35 },
  { name: 'Samusa', name_en: 'Samusa', name_ar: 'سمبوسة', category: 'Appetizers - المقبلات', price: 0.87 },
  { name: 'Shrimp cocktail', name_en: 'Shrimp cocktail', name_ar: 'كوكتيل ربيان', category: 'Appetizers - المقبلات', price: 20.00 },
  { name: 'Spring rolls', name_en: 'Spring rolls', name_ar: 'لفائف الربيع', category: 'Appetizers - المقبلات', price: 15.65 },
  { name: 'Steamed sumai', name_en: 'Steamed sumai', name_ar: 'سُمّي مطهو على البخار', category: 'Appetizers - المقبلات', price: 24.35 },
  { name: 'Tuna/Sami', name_en: 'Tuna/Sami', name_ar: 'تونة/سامي', category: 'Appetizers - المقبلات', price: 4.35 },
  { name: 'Veg. cutlet', name_en: 'Veg. cutlet', name_ar: 'كُتلة خضار', category: 'Appetizers - المقبلات', price: 12.17 },
  { name: 'Veg tempura', name_en: 'Veg tempura', name_ar: 'خضار تمبورا', category: 'Appetizers - المقبلات', price: 13.91 },

  // BEEF & LAMB - لحم بقر وخروف
  { name: 'Beef in black', name_en: 'Beef in black', name_ar: 'لحم بقر بالفصوليا', category: 'BEEF & LAMB - لحم بقر وخروف', price: 38.26 },
  { name: 'Beef oyster', name_en: 'Beef oyster', name_ar: 'لحم خروف محمر', category: 'BEEF & LAMB - لحم بقر وخروف', price: 38.26 },
  { name: 'Beef roast', name_en: 'Beef roast', name_ar: 'روست بقر', category: 'BEEF & LAMB - لحم بقر وخروف', price: 47.83 },
  { name: 'Beef steak', name_en: 'Beef steak', name_ar: 'ستيك بقر', category: 'BEEF & LAMB - لحم بقر وخروف', price: 47.83 },
  { name: 'Chili beef', name_en: 'Chili beef', name_ar: 'لحم بقر حار', category: 'BEEF & LAMB - لحم بقر وخروف', price: 38.26 },
  { name: 'Hunan beef', name_en: 'Hunan beef', name_ar: 'لحم هونان', category: 'BEEF & LAMB - لحم بقر وخروف', price: 38.26 },
  { name: 'Lamb chop curry', name_en: 'Lamb chop curry', name_ar: 'ريش غنم بالكاري', category: 'BEEF & LAMB - لحم بقر وخروف', price: 41.74 },
  { name: 'Lamb & leek', name_en: 'Lamb & leek', name_ar: 'خروف بالكراث', category: 'BEEF & LAMB - لحم بقر وخروف', price: 38.26 },
  { name: 'Lamb roast', name_en: 'Lamb roast', name_ar: 'روست غنم', category: 'BEEF & LAMB - لحم بقر وخروف', price: 47.83 },
  { name: 'Orange beef', name_en: 'Orange beef', name_ar: 'لحم بقر بالبرتقال', category: 'BEEF & LAMB - لحم بقر وخروف', price: 38.26 },
  { name: 'S & S beef', name_en: 'S & S beef', name_ar: 'لحم بقر حلو وحار', category: 'BEEF & LAMB - لحم بقر وخروف', price: 38.26 },

  // CHARCOLA GRILL / KEBABS - المشويات
  { name: 'Abdi Chicken Kebab', name_en: 'Abdi Chicken Kebab', name_ar: 'كباب دجاج عبدي', category: 'CHARCOLA GRILL / KEBABS - المشويات', price: 27.83 },
  { name: 'Afgani Chicken Kebab', name_en: 'Afgani Chicken Kebab', name_ar: 'كباب دجاج أفغاني', category: 'CHARCOLA GRILL / KEBABS - المشويات', price: 27.83 },
  { name: 'Angara Chicken Kebab', name_en: 'Angara Chicken Kebab', name_ar: 'كباب دجاج أنجارا', category: 'CHARCOLA GRILL / KEBABS - المشويات', price: 38.26 },
  { name: 'Angara Mutton Kebab', name_en: 'Angara Mutton Kebab', name_ar: 'كباب لحم ضأن أنجارا', category: 'CHARCOLA GRILL / KEBABS - المشويات', price: 38.26 },
  { name: 'Chicken Hariali Kebab', name_en: 'Chicken Hariali Kebab', name_ar: 'كباب دجاج هاريالي', category: 'CHARCOLA GRILL / KEBABS - المشويات', price: 38.26 },
  { name: 'Chicken Kalmi Kebab', name_en: 'Chicken Kalmi Kebab', name_ar: 'كباب دجاج كالمي', category: 'CHARCOLA GRILL / KEBABS - المشويات', price: 38.26 },
  { name: 'Chicken Makmali Kebab', name_en: 'Chicken Makmali Kebab', name_ar: 'كباب دجاج مكملي', category: 'CHARCOLA GRILL / KEBABS - المشويات', price: 38.26 },
  { name: 'Chicken Malai Kebab', name_en: 'Chicken Malai Kebab', name_ar: 'كباب دجاج مالاي', category: 'CHARCOLA GRILL / KEBABS - المشويات', price: 40.00 },
  { name: 'Chicken Sish Kebab', name_en: 'Chicken Sish Kebab', name_ar: 'سيش كباب دجاج', category: 'CHARCOLA GRILL / KEBABS - المشويات', price: 38.26 },
  { name: 'Chicken Tangri Kebab', name_en: 'Chicken Tangri Kebab', name_ar: 'كباب دجاج تانجري', category: 'CHARCOLA GRILL / KEBABS - المشويات', price: 21.74 },
  { name: 'Chickntika (1/2)', name_en: 'Chickntika (1/2)', name_ar: 'دجاج تيكا نصف', category: 'CHARCOLA GRILL / KEBABS - المشويات', price: 27.83 },
  { name: 'Chickntika (full)', name_en: 'Chickntika (full)', name_ar: 'دجاج تيكا كامل', category: 'CHARCOLA GRILL / KEBABS - المشويات', price: 40.00 },
  { name: 'Fish boti', name_en: 'Fish boti', name_ar: 'سمك بوتي', category: 'CHARCOLA GRILL / KEBABS - المشويات', price: 38.26 },
  { name: 'Fish Tikka', name_en: 'Fish Tikka', name_ar: 'سمك تيكا', category: 'CHARCOLA GRILL / KEBABS - المشويات', price: 38.26 },
  { name: 'Grilled Prawn', name_en: 'Grilled Prawn', name_ar: 'ربيان مشوي', category: 'CHARCOLA GRILL / KEBABS - المشويات', price: 41.74 },
  { name: 'Grilled fish (L)', name_en: 'Grilled fish (L)', name_ar: 'سمك مشوي (كبير)', category: 'CHARCOLA GRILL / KEBABS - المشويات', price: 69.57 },
  { name: 'Grilled fish (M)', name_en: 'Grilled fish (M)', name_ar: 'سمك مشوي (متوسط)', category: 'CHARCOLA GRILL / KEBABS - المشويات', price: 60.87 },
  { name: 'Lamb chop', name_en: 'Lamb chop', name_ar: 'ريش غنم', category: 'CHARCOLA GRILL / KEBABS - المشويات', price: 41.74 },
  { name: 'Mixed grill', name_en: 'Mixed grill', name_ar: 'مشويات مشكلة', category: 'CHARCOLA GRILL / KEBABS - المشويات', price: 47.83 },
  { name: 'Mutton Hariali Kebab', name_en: 'Mutton Hariali Kebab', name_ar: 'كباب لحم ضأن هاريالي', category: 'CHARCOLA GRILL / KEBABS - المشويات', price: 38.26 },
  { name: 'Mutton Laziz Tikka', name_en: 'Mutton Laziz Tikka', name_ar: 'لحم ضأن لذيذ تيكا', category: 'CHARCOLA GRILL / KEBABS - المشويات', price: 40.00 },
  { name: 'Samrat Kebab', name_en: 'Samrat Kebab', name_ar: 'كباب سمرات', category: 'CHARCOLA GRILL / KEBABS - المشويات', price: 38.26 },

  // CHICKEN - دجاج
  { name: 'Chicken garlic', name_en: 'Chicken garlic', name_ar: 'دجاج بصلصة الثوم', category: 'CHICKEN - دجاج', price: 38.26 },
  { name: 'Chkn 65', name_en: 'Chkn 65', name_ar: 'دجاج 65', category: 'CHICKEN - دجاج', price: 38.26 },
  { name: 'Chkn bambo', name_en: 'Chkn bambo', name_ar: 'دجاج بالفطر', category: 'CHICKEN - دجاج', price: 38.26 },
  { name: 'Chkn chili onion', name_en: 'Chkn chili onion', name_ar: 'دجاج حار مع بصل', category: 'CHICKEN - دجاج', price: 38.26 },
  { name: 'Fried chicken', name_en: 'Fried chicken', name_ar: 'دجاج مقلي', category: 'CHICKEN - دجاج', price: 38.26 },
  { name: 'Kongpo chicken', name_en: 'Kongpo chicken', name_ar: 'دجاج كونغبو', category: 'CHICKEN - دجاج', price: 38.26 },
  { name: 'Manchurian chicken', name_en: 'Manchurian chicken', name_ar: 'دجاج مانشوري', category: 'CHICKEN - دجاج', price: 38.26 },
  { name: 'Peking chicken', name_en: 'Peking chicken', name_ar: 'دجاج بكين', category: 'CHICKEN - دجاج', price: 38.26 },
  { name: 'Pineapple chicken', name_en: 'Pineapple chicken', name_ar: 'دجاج بالأناناس', category: 'CHICKEN - دجاج', price: 38.26 },
  { name: 'Sz. chili chicken', name_en: 'Sz. chili chicken', name_ar: 'دجاج بالفلفل الحار الصيني', category: 'CHICKEN - دجاج', price: 38.26 },
  { name: 'Thai chicken', name_en: 'Thai chicken', name_ar: 'دجاج تايلندي', category: 'CHICKEN - دجاج', price: 38.26 },

  // CHINESE SIZZLING - طبق ساخن
  { name: 'Chicken/beef balti', name_en: 'Chicken/beef balti', name_ar: 'دجاج أو لحم بالكاري بالتي', category: 'CHINESE SIZZLING - طبق ساخن', price: 45.22 },
  { name: 'Duck sizzling', name_en: 'Duck sizzling', name_ar: 'بطة سيزلنغ', category: 'CHINESE SIZZLING - طبق ساخن', price: 50.43 },
  { name: 'Mix balti', name_en: 'Mix balti', name_ar: 'كاري مشكلة', category: 'CHINESE SIZZLING - طبق ساخن', price: 50.43 },
  { name: 'Prawn balti', name_en: 'Prawn balti', name_ar: 'ربيان بالكاري', category: 'CHINESE SIZZLING - طبق ساخن', price: 50.43 },
  { name: 'Seafood sizzling', name_en: 'Seafood sizzling', name_ar: 'مأكولات بحرية سيزلنغ', category: 'CHINESE SIZZLING - طبق ساخن', price: 50.43 },
  { name: 'Sizzling beef', name_en: 'Sizzling beef', name_ar: 'لحم بقر وغنم سيزلنغ', category: 'CHINESE SIZZLING - طبق ساخن', price: 45.22 },
  { name: 'Sizzling chicken', name_en: 'Sizzling chicken', name_ar: 'دجاج سيزلنغ', category: 'CHINESE SIZZLING - طبق ساخن', price: 45.22 },
  { name: 'Sizzling fish', name_en: 'Sizzling fish', name_ar: 'سمك سيزلنغ', category: 'CHINESE SIZZLING - طبق ساخن', price: 46.09 },
  { name: 'Sizzling mix', name_en: 'Sizzling mix', name_ar: 'مشكلة سيزلنغ', category: 'CHINESE SIZZLING - طبق ساخن', price: 50.43 },
  { name: 'Sizzling prawn', name_en: 'Sizzling prawn', name_ar: 'ربيان سيزلنغ', category: 'CHINESE SIZZLING - طبق ساخن', price: 50.43 },

  // Drinks - المشروبات
  { name: 'Banana split', name_en: 'Banana split', name_ar: 'بانانا سبليت', category: 'Drinks - المشروبات', price: 13.91 },
  { name: 'Champagne (L)', name_en: 'Champagne (L)', name_ar: 'كوكتيل سعودي كبير', category: 'Drinks - المشروبات', price: 50.43 },
  { name: 'Champagne (M)', name_en: 'Champagne (M)', name_ar: 'كوكتيل سعودي متوسط', category: 'Drinks - المشروبات', price: 40.00 },
  { name: 'Champagne (S)', name_en: 'Champagne (S)', name_ar: 'كوكتيل سعودي صغير', category: 'Drinks - المشروبات', price: 20.00 },
  { name: 'Coca Cola', name_en: 'Coca Cola', name_ar: 'كوكا كولا', category: 'Drinks - المشروبات', price: 5.22 },
  { name: 'Cocktail juice', name_en: 'Cocktail juice', name_ar: 'عصير كوكتيل', category: 'Drinks - المشروبات', price: 13.91 },
  { name: 'Fruit salad ice cream', name_en: 'Fruit salad ice cream', name_ar: 'سلطة فواكه مع آيس كريم', category: 'Drinks - المشروبات', price: 13.04 },
  { name: 'Fruit salad', name_en: 'Fruit salad', name_ar: 'سلطة فواكه', category: 'Drinks - المشروبات', price: 13.04 },
  { name: 'Ice cream', name_en: 'Ice cream', name_ar: 'آيس كريم', category: 'Drinks - المشروبات', price: 10.43 },
  { name: 'Iced tea (L)', name_en: 'Iced tea (L)', name_ar: 'شاي مثلج كبير', category: 'Drinks - المشروبات', price: 24.35 },
  { name: 'Iced tea (M)', name_en: 'Iced tea (M)', name_ar: 'شاي مثلج متوسط', category: 'Drinks - المشروبات', price: 20.00 },
  { name: 'Iced tea (S)', name_en: 'Iced tea (S)', name_ar: 'شاي مثلج صغير', category: 'Drinks - المشروبات', price: 14.78 },
  { name: 'Orange juice', name_en: 'Orange juice', name_ar: 'عصير برتقال', category: 'Drinks - المشروبات', price: 13.91 },
  { name: 'Pepsi', name_en: 'Pepsi', name_ar: 'بيبسي', category: 'Drinks - المشروبات', price: 5.22 },
  { name: 'Tea/coffee', name_en: 'Tea/coffee', name_ar: 'شاي أو قهوة', category: 'Drinks - المشروبات', price: 3.48 },
  { name: 'Water large', name_en: 'Water large', name_ar: 'ماء كبير', category: 'Drinks - المشروبات', price: 4.35 },
  { name: 'Water small', name_en: 'Water small', name_ar: 'ماء صغير', category: 'Drinks - المشروبات', price: 1.74 },

  // HOUSE SPECIAL - مخصوص للبيت
  { name: 'Duck roast', name_en: 'Duck roast', name_ar: 'بطة مشوية', category: 'HOUSE SPECIAL - مخصوص للبيت', price: 52.17 },
  { name: 'Fried duck', name_en: 'Fried duck', name_ar: 'بطة مقلي', category: 'HOUSE SPECIAL - مخصوص للبيت', price: 50.43 },
  { name: 'King lobster', name_en: 'King lobster', name_ar: 'سرطان البحر الملكي', category: 'HOUSE SPECIAL - مخصوص للبيت', price: 100.00 },
  { name: 'Peking duck', name_en: 'Peking duck', name_ar: 'بطة بكين', category: 'HOUSE SPECIAL - مخصوص للبيت', price: 50.43 },
  { name: 'R Tiger lobster', name_en: 'R Tiger lobster', name_ar: 'سرطان البحر رويل تايغر', category: 'HOUSE SPECIAL - مخصوص للبيت', price: 180.00 },
  { name: 'Tiger lobster', name_en: 'Tiger lobster', name_ar: 'سرطان البحر تايغر', category: 'HOUSE SPECIAL - مخصوص للبيت', price: 140.00 },
  { name: 'Whole sea lobster', name_en: 'Whole sea lobster', name_ar: 'سرطان البحر كامل', category: 'HOUSE SPECIAL - مخصوص للبيت', price: 85.22 },

  // INDIAN DELICACY (CHICKEN) - دجاج هندي
  { name: 'Bhuna', name_en: 'Bhuna', name_ar: 'بونا', category: 'INDIAN DELICACY (CHICKEN) - دجاج هندي', price: 38.26 },
  { name: 'Butter chicken', name_en: 'Butter chicken', name_ar: 'دجاج بالزبدة', category: 'INDIAN DELICACY (CHICKEN) - دجاج هندي', price: 40.00 },
  { name: 'Butter dal', name_en: 'Butter dal', name_ar: 'دال بالزبدة', category: 'INDIAN DELICACY (CHICKEN) - دجاج هندي', price: 26.96 },
  { name: 'Chicken curry', name_en: 'Chicken curry', name_ar: 'دجاج بالكاري', category: 'INDIAN DELICACY (CHICKEN) - دجاج هندي', price: 38.26 },
  { name: 'Chkn 65', name_en: 'Chkn 65', name_ar: 'دجاج 65', category: 'INDIAN DELICACY (CHICKEN) - دجاج هندي', price: 38.26 },
  { name: 'Chkn masala', name_en: 'Chkn masala', name_ar: 'دجاج ماسالا', category: 'INDIAN DELICACY (CHICKEN) - دجاج هندي', price: 38.26 },
  { name: 'Chkn roast', name_en: 'Chkn roast', name_ar: 'دجاج مشوي', category: 'INDIAN DELICACY (CHICKEN) - دجاج هندي', price: 38.26 },
  { name: 'Dal gosh', name_en: 'Dal gosh', name_ar: 'دال جوش', category: 'INDIAN DELICACY (CHICKEN) - دجاج هندي', price: 38.26 },
  { name: 'Fish curry', name_en: 'Fish curry', name_ar: 'سمك بالكاري', category: 'INDIAN DELICACY (CHICKEN) - دجاج هندي', price: 38.26 },
  { name: 'Handi', name_en: 'Handi', name_ar: 'هاندي', category: 'INDIAN DELICACY (CHICKEN) - دجاج هندي', price: 40.00 },
  { name: 'Karai', name_en: 'Karai', name_ar: 'كراي', category: 'INDIAN DELICACY (CHICKEN) - دجاج هندي', price: 40.00 },
  { name: 'Korma', name_en: 'Korma', name_ar: 'كورما', category: 'INDIAN DELICACY (CHICKEN) - دجاج هندي', price: 38.26 },
  { name: 'Lambchop curry', name_en: 'Lambchop curry', name_ar: 'ريش غنم بالكاري', category: 'INDIAN DELICACY (CHICKEN) - دجاج هندي', price: 41.74 },
  { name: 'Muglai prawn', name_en: 'Muglai prawn', name_ar: 'ربيان موغلاي', category: 'INDIAN DELICACY (CHICKEN) - دجاج هندي', price: 69.57 },
  { name: 'Muglai whole fish (L)', name_en: 'Muglai whole fish (L)', name_ar: 'سمك كامل موغلاي (كبير)', category: 'INDIAN DELICACY (CHICKEN) - دجاج هندي', price: 69.57 },
  { name: 'Muglai whole fish (M)', name_en: 'Muglai whole fish (M)', name_ar: 'سمك كامل موغلاي (متوسط)', category: 'INDIAN DELICACY (CHICKEN) - دجاج هندي', price: 60.87 },
  { name: 'Prawn masala', name_en: 'Prawn masala', name_ar: 'ربيان ماسالا', category: 'INDIAN DELICACY (CHICKEN) - دجاج هندي', price: 41.74 },
  { name: 'Tarka dal', name_en: 'Tarka dal', name_ar: 'دال تاركا', category: 'INDIAN DELICACY (CHICKEN) - دجاج هندي', price: 26.09 },
  { name: 'Tikka masala', name_en: 'Tikka masala', name_ar: 'تيكا ماسالا', category: 'INDIAN DELICACY (CHICKEN) - دجاج هندي', price: 40.00 },

  // INDIAN DELICACY (FISH) - سمك هندي
  { name: 'Fried whole fish (L)', name_en: 'Fried whole fish (L)', name_ar: 'سمك مقلي كامل (كبير)', category: 'INDIAN DELICACY (FISH) - سمك هندي', price: 69.57 },
  { name: 'Fried whole fish (M)', name_en: 'Fried whole fish (M)', name_ar: 'سمك مقلي كامل (متوسط)', category: 'INDIAN DELICACY (FISH) - سمك هندي', price: 60.87 },
  { name: 'Fish ball', name_en: 'Fish ball', name_ar: 'كرات سمك', category: 'INDIAN DELICACY (FISH) - سمك هندي', price: 40.00 },
  { name: 'Fish chili onion', name_en: 'Fish chili onion', name_ar: 'سمك حار مع بصل', category: 'INDIAN DELICACY (FISH) - سمك هندي', price: 40.00 },
  { name: 'Fish in hot sauce', name_en: 'Fish in hot sauce', name_ar: 'سمك بصلصة حارة', category: 'INDIAN DELICACY (FISH) - سمك هندي', price: 40.00 },
  { name: 'Fried fish', name_en: 'Fried fish', name_ar: 'سمك مقلي', category: 'INDIAN DELICACY (FISH) - سمك هندي', price: 40.00 },
  { name: 'Szechuan fish', name_en: 'Szechuan fish', name_ar: 'سمك سيتشوان', category: 'INDIAN DELICACY (FISH) - سمك هندي', price: 40.00 },
  { name: 'Shanhi smoked fish', name_en: 'Shanhi smoked fish', name_ar: 'سمك مدخن شانهي', category: 'INDIAN DELICACY (FISH) - سمك هندي', price: 40.00 },
  { name: 'S&S fish', name_en: 'S&S fish', name_ar: 'سمك حلو وحامض', category: 'INDIAN DELICACY (FISH) - سمك هندي', price: 40.00 },
  { name: 'Steamed fish', name_en: 'Steamed fish', name_ar: 'سمك بالبخار', category: 'INDIAN DELICACY (FISH) - سمك هندي', price: 41.74 },

  // INDIAN DELICACY (VEGETABLES) - خضروات هندية
  { name: 'Alu motor', name_en: 'Alu motor', name_ar: 'بطاطس وبازيلاء', category: 'INDIAN DELICACY (VEGETABLES) - خضروات هندية', price: 27.83 },
  { name: 'Butter dal', name_en: 'Butter dal', name_ar: 'دال بالزبدة', category: 'INDIAN DELICACY (VEGETABLES) - خضروات هندية', price: 26.96 },
  { name: 'Chana masala', name_en: 'Chana masala', name_ar: 'الحمص بالماسالا', category: 'INDIAN DELICACY (VEGETABLES) - خضروات هندية', price: 27.83 },
  { name: 'Kaju matar', name_en: 'Kaju matar', name_ar: 'كاجو وبازيلاء', category: 'INDIAN DELICACY (VEGETABLES) - خضروات هندية', price: 27.83 },
  { name: 'Mix veg', name_en: 'Mix veg', name_ar: 'خضار مشكلة', category: 'INDIAN DELICACY (VEGETABLES) - خضروات هندية', price: 30.43 },
  { name: 'Muglai veg', name_en: 'Muglai veg', name_ar: 'خضار موغلاي', category: 'INDIAN DELICACY (VEGETABLES) - خضروات هندية', price: 27.83 },
  { name: 'Okra masala', name_en: 'Okra masala', name_ar: 'بامية ماسالا', category: 'INDIAN DELICACY (VEGETABLES) - خضروات هندية', price: 27.83 },
  { name: 'Palak paneer', name_en: 'Palak paneer', name_ar: 'سبانخ وبانير', category: 'INDIAN DELICACY (VEGETABLES) - خضروات هندية', price: 27.83 },
  { name: 'Tarka dal', name_en: 'Tarka dal', name_ar: 'دال تاركا', category: 'INDIAN DELICACY (VEGETABLES) - خضروات هندية', price: 26.09 },
  { name: 'Veg karai', name_en: 'Veg karai', name_ar: 'خضار كراي', category: 'INDIAN DELICACY (VEGETABLES) - خضروات هندية', price: 34.78 },
  { name: 'Veg kofta', name_en: 'Veg kofta', name_ar: 'كفتة خضار', category: 'INDIAN DELICACY (VEGETABLES) - خضروات هندية', price: 27.83 },

  // NOODLES & CHOPSUEY - معكرونة
  { name: 'Chicken noodles', name_en: 'Chicken noodles', name_ar: 'نودلز دجاج', category: 'NOODLES & CHOPSUEY - معكرونة', price: 27.83 },
  { name: 'Chinese chopsuey', name_en: 'Chinese chopsuey', name_ar: 'تشوبسوي صيني', category: 'NOODLES & CHOPSUEY - معكرونة', price: 30.43 },
  { name: 'Fettuccini chicken', name_en: 'Fettuccini chicken', name_ar: 'فتوثيني دجاج', category: 'NOODLES & CHOPSUEY - معكرونة', price: 34.78 },
  { name: 'Mixed noodles', name_en: 'Mixed noodles', name_ar: 'نودلز مشكلة', category: 'NOODLES & CHOPSUEY - معكرونة', price: 30.43 },
  { name: 'Penne prawn', name_en: 'Penne prawn', name_ar: 'بيني بالربيان', category: 'NOODLES & CHOPSUEY - معكرونة', price: 40.00 },
  { name: 'Seafood noodles', name_en: 'Seafood noodles', name_ar: 'نودلز مأكولات بحرية', category: 'NOODLES & CHOPSUEY - معكرونة', price: 32.17 },
  { name: 'Stirred noodles', name_en: 'Stirred noodles', name_ar: 'نودلز مقلي', category: 'NOODLES & CHOPSUEY - معكرونة', price: 30.43 },
  { name: 'Szechuan noodles', name_en: 'Szechuan noodles', name_ar: 'نودلز سيتشوان حار', category: 'NOODLES & CHOPSUEY - معكرونة', price: 30.43 },
  { name: 'Veg noodles', name_en: 'Veg noodles', name_ar: 'نودلز خضار', category: 'NOODLES & CHOPSUEY - معكرونة', price: 24.34 },

  // PRAWNS - ربيان
  { name: 'Carbon shell', name_en: 'Carbon shell', name_ar: 'كربون شيل', category: 'PRAWNS - ربيان', price: 47.83 },
  { name: 'Hunan prawn', name_en: 'Hunan prawn', name_ar: 'ربيان هونان', category: 'PRAWNS - ربيان', price: 47.83 },
  { name: 'Mandarin prawn', name_en: 'Mandarin prawn', name_ar: 'ربيان منديرين', category: 'PRAWNS - ربيان', price: 50.43 },
  { name: 'Mongolian prawn', name_en: 'Mongolian prawn', name_ar: 'ربيان منغولي', category: 'PRAWNS - ربيان', price: 47.83 },
  { name: 'Peking prawn', name_en: 'Peking prawn', name_ar: 'ربيان بكين', category: 'PRAWNS - ربيان', price: 47.83 },
  { name: 'Prawn garlic', name_en: 'Prawn garlic', name_ar: 'ربيان بصلصة الثوم', category: 'PRAWNS - ربيان', price: 45.22 },
  { name: 'Prawn mushroom', name_en: 'Prawn mushroom', name_ar: 'ربيان بالفطر', category: 'PRAWNS - ربيان', price: 46.96 },
  { name: 'Prawn nut', name_en: 'Prawn nut', name_ar: 'ربيان بالكاجو', category: 'PRAWNS - ربيان', price: 50.43 },
  { name: 'Special modern prawn', name_en: 'Special modern prawn', name_ar: 'ربيان منديرين خاص', category: 'PRAWNS - ربيان', price: 69.57 },
  { name: 'S&S prawn', name_en: 'S&S prawn', name_ar: 'ربيان حلو وحامض', category: 'PRAWNS - ربيان', price: 47.83 },

  // SALADS - سلطات
  { name: 'Chicken/prawn mayo', name_en: 'Chicken/prawn mayo', name_ar: 'سلطة دجاج أو ربيان بالمايونيز', category: 'SALADS - سلطات', price: 20.00 },
  { name: 'Fattoush', name_en: 'Fattoush', name_ar: 'فتوش', category: 'SALADS - سلطات', price: 12.17 },
  { name: 'Grape leaves', name_en: 'Grape leaves', name_ar: 'ورق عنب', category: 'SALADS - سلطات', price: 12.17 },
  { name: 'Green salad', name_en: 'Green salad', name_ar: 'سلطة خضراء', category: 'SALADS - سلطات', price: 12.17 },
  { name: 'Hummus', name_en: 'Hummus', name_ar: 'حمص', category: 'SALADS - سلطات', price: 10.43 },
  { name: 'Pangpang chicken', name_en: 'Pangpang chicken', name_ar: 'دجاج بانغ بانغ', category: 'SALADS - سلطات', price: 14.78 },
  { name: 'Prawn salad', name_en: 'Prawn salad', name_ar: 'سلطة ربيان', category: 'SALADS - سلطات', price: 20.00 },
  { name: 'Rainbow salad', name_en: 'Rainbow salad', name_ar: 'سلطة قوس قزح', category: 'SALADS - سلطات', price: 14.78 },
  { name: 'Samrat salad', name_en: 'Samrat salad', name_ar: 'سلطة سامرات', category: 'SALADS - سلطات', price: 20.00 },
  { name: 'Szechuan salad', name_en: 'Szechuan salad', name_ar: 'سلطة سيتشوان', category: 'SALADS - سلطات', price: 18.26 },
  { name: 'Shrimp cocktail', name_en: 'Shrimp cocktail', name_ar: 'كوكتيل ربيان', category: 'SALADS - سلطات', price: 20.00 },
  { name: 'Tabbula', name_en: 'Tabbula', name_ar: 'تبولة', category: 'SALADS - سلطات', price: 12.17 },

  // SHAW FAW - شاو فاو
  { name: 'Chicken shaw faw', name_en: 'Chicken shaw faw', name_ar: 'شاو فاو دجاج', category: 'SHAW FAW - شاو فاو', price: 45.22 },
  { name: 'Prawn shaw faw', name_en: 'Prawn shaw faw', name_ar: 'شاو فاو ربيان', category: 'SHAW FAW - شاو فاو', price: 50.43 },
  { name: 'Seafood shaw faw', name_en: 'Seafood shaw faw', name_ar: 'شاو فاو مأكولات بحرية', category: 'SHAW FAW - شاو فاو', price: 50.43 },

  // SOUPS - شوربات
  { name: 'Chicken lemon soup', name_en: 'Chicken lemon soup', name_ar: 'شوربة دجاج بليمون', category: 'SOUPS - شوربات', price: 26.09 },
  { name: 'Chinese noodle soup', name_en: 'Chinese noodle soup', name_ar: 'شوربة نودلز صيني', category: 'SOUPS - شوربات', price: 34.78 },
  { name: 'Corn soup', name_en: 'Corn soup', name_ar: 'شوربة ذرة', category: 'SOUPS - شوربات', price: 21.74 },
  { name: 'Cream of chicken', name_en: 'Cream of chicken', name_ar: 'شوربة دجاج كريمية', category: 'SOUPS - شوربات', price: 30.43 },
  { name: 'Dal soup', name_en: 'Dal soup', name_ar: 'شوربة عدس', category: 'SOUPS - شوربات', price: 20.00 },
  { name: 'Duck soup', name_en: 'Duck soup', name_ar: 'شوربة بطة', category: 'SOUPS - شوربات', price: 34.78 },
  { name: 'Hot & sour soup', name_en: 'Hot & sour soup', name_ar: 'شوربة حارة وحامضة', category: 'SOUPS - شوربات', price: 21.74 },
  { name: 'H/S bean curd', name_en: 'H/S bean curd', name_ar: 'شوربة توفو حارة وحامضة', category: 'SOUPS - شوربات', price: 21.74 },
  { name: 'Lobster soup', name_en: 'Lobster soup', name_ar: 'شوربة سرطان البحر', category: 'SOUPS - شوربات', price: 85.22 },
  { name: 'Mixed chicken soup', name_en: 'Mixed chicken soup', name_ar: 'شوربة دجاج مشكلة', category: 'SOUPS - شوربات', price: 21.74 },
  { name: 'Prawn vegetable soup', name_en: 'Prawn vegetable soup', name_ar: 'شوربة ربيان بالخضار', category: 'SOUPS - شوربات', price: 26.09 },
  { name: 'Seafood soup', name_en: 'Seafood soup', name_ar: 'شوربة مأكولات بحرية', category: 'SOUPS - شوربات', price: 30.43 },
  { name: 'Steamed bottom seafood soup', name_en: 'Steamed bottom seafood soup', name_ar: 'شوربة مأكولات بحرية بالبخار', category: 'SOUPS - شوربات', price: 69.57 },
  { name: 'Thai soup', name_en: 'Thai soup', name_ar: 'شوربة تايلندية', category: 'SOUPS - شوربات', price: 26.09 },
  { name: 'Tom yum soup', name_en: 'Tom yum soup', name_ar: 'شوربة توم يوم', category: 'SOUPS - شوربات', price: 30.43 },
  { name: 'Wanton soup', name_en: 'Wanton soup', name_ar: 'شوربة وان تون', category: 'SOUPS - شوربات', price: 26.09 },
];

async function addMenuProducts() {
  try {
    console.log('=== إضافة منتجات القائمة إلى قاعدة البيانات ===\n');
    console.log(`عدد المنتجات: ${menuProducts.length}\n`);

    let added = 0;
    let skipped = 0;
    let errors = 0;

    for (const product of menuProducts) {
      try {
        // Check if product already exists
        const checkResult = await pool.query(
          'SELECT id FROM products WHERE name = $1 OR name_en = $2 LIMIT 1',
          [product.name, product.name_en]
        );

        if (checkResult.rows.length > 0) {
          console.log(`⏭️  تم تخطي: ${product.name} (موجود بالفعل)`);
          skipped++;
          continue;
        }

        // Insert product - using same structure as server.js POST /products
        // Table structure: name, name_en, sku, barcode, category, unit, price, cost, tax_rate, stock_quantity, min_stock, description, is_active
        const result = await pool.query(
          `INSERT INTO products (
            name, name_en, category, price, cost, tax_rate,
            stock_quantity, min_stock, is_active, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
          RETURNING id, name`,
          [
            product.name,                    // name
            product.name_en,                 // name_en
            product.category,                // category
            product.price,                  // price
            product.price * 0.7,            // cost (70% of sale price)
            15,                             // tax_rate (default 15%)
            0,                              // stock_quantity
            0,                              // min_stock
            true                            // is_active
          ]
        );

        console.log(`✅ تمت الإضافة: ${product.name} (ID: ${result.rows[0].id})`);
        added++;
      } catch (e) {
        const errorMsg = e.message || String(e);
        console.error(`❌ خطأ في إضافة ${product.name}:`, errorMsg);
        if (errorMsg && !errorMsg.includes('duplicate') && !errorMsg.includes('already exists')) {
          // Only show full error for first few errors to avoid spam
          if (errors < 3) {
            console.error('   التفاصيل الكاملة:', e.stack || e);
          }
        }
        errors++;
      }
    }

    console.log('\n=== النتائج ===');
    console.log(`✅ تمت الإضافة: ${added}`);
    console.log(`⏭️  تم التخطي: ${skipped}`);
    console.log(`❌ أخطاء: ${errors}`);
    console.log(`📊 الإجمالي: ${menuProducts.length}`);

    await pool.end();
    console.log('\n✅ تم الانتهاء بنجاح!');
  } catch (e) {
    console.error('❌ خطأ عام:', e.message);
    console.error(e.stack);
    await pool.end();
    process.exit(1);
  }
}

addMenuProducts();
