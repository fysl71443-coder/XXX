import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Menu products data - same as add_menu_products.js
const menuProducts = [
  // Appetizers - المقبلات
  { name: 'Butterfly prawn', name_en: 'Butterfly prawn', category: 'Appetizers - المقبلات', price: 41.74 },
  { name: 'Butternan', name_en: 'Butternan', category: 'Appetizers - المقبلات', price: 3.48 },
  { name: 'Fried wanton', name_en: 'Fried wanton', category: 'Appetizers - المقبلات', price: 20.00 },
  { name: 'Fishcakes', name_en: 'Fishcakes', category: 'Appetizers - المقبلات', price: 4.35 },
  { name: 'Fish finger', name_en: 'Fish finger', category: 'Appetizers - المقبلات', price: 30.43 },
  { name: 'French fry', name_en: 'French fry', category: 'Appetizers - المقبلات', price: 12.17 },
  { name: 'Fried fish', name_en: 'Fried fish', category: 'Appetizers - المقبلات', price: 40.00 },
  { name: 'Fried prawns', name_en: 'Fried prawns', category: 'Appetizers - المقبلات', price: 41.74 },
  { name: 'Garlic nan', name_en: 'Garlic nan', category: 'Appetizers - المقبلات', price: 3.48 },
  { name: 'Gold fried prawns', name_en: 'Gold fried prawns', category: 'Appetizers - المقبلات', price: 41.74 },
  { name: 'Hummus', name_en: 'Hummus', category: 'Appetizers - المقبلات', price: 10.43 },
  { name: 'Kaichai', name_en: 'Kaichai', category: 'Appetizers - المقبلات', price: 15.65 },
  { name: 'Mixed appetizers (L)', name_en: 'Mixed appetizers (L)', category: 'Appetizers - المقبلات', price: 34.78 },
  { name: 'Mixed appetizers (M)', name_en: 'Mixed appetizers (M)', category: 'Appetizers - المقبلات', price: 25.22 },
  { name: 'Plain nan', name_en: 'Plain nan', category: 'Appetizers - المقبلات', price: 0.87 },
  { name: 'Potato chop', name_en: 'Potato chop', category: 'Appetizers - المقبلات', price: 3.48 },
  { name: 'Prawn balls', name_en: 'Prawn balls', category: 'Appetizers - المقبلات', price: 26.09 },
  { name: 'Prawn Tempura', name_en: 'Prawn Tempura', category: 'Appetizers - المقبلات', price: 14.78 },
  { name: 'Prawn toast', name_en: 'Prawn toast', category: 'Appetizers - المقبلات', price: 24.35 },
  { name: 'Samusa', name_en: 'Samusa', category: 'Appetizers - المقبلات', price: 0.87 },
  { name: 'Shrimp cocktail', name_en: 'Shrimp cocktail', category: 'Appetizers - المقبلات', price: 20.00 },
  { name: 'Spring rolls', name_en: 'Spring rolls', category: 'Appetizers - المقبلات', price: 15.65 },
  { name: 'Steamed sumai', name_en: 'Steamed sumai', category: 'Appetizers - المقبلات', price: 24.35 },
  { name: 'Tuna/Sami', name_en: 'Tuna/Sami', category: 'Appetizers - المقبلات', price: 4.35 },
  { name: 'Veg. cutlet', name_en: 'Veg. cutlet', category: 'Appetizers - المقبلات', price: 12.17 },
  { name: 'Veg tempura', name_en: 'Veg tempura', category: 'Appetizers - المقبلات', price: 13.91 },

  // BEEF & LAMB - لحم بقر وخروف
  { name: 'Beef in black', name_en: 'Beef in black', category: 'BEEF & LAMB - لحم بقر وخروف', price: 38.26 },
  { name: 'Beef oyster', name_en: 'Beef oyster', category: 'BEEF & LAMB - لحم بقر وخروف', price: 38.26 },
  { name: 'Beef roast', name_en: 'Beef roast', category: 'BEEF & LAMB - لحم بقر وخروف', price: 47.83 },
  { name: 'Beef steak', name_en: 'Beef steak', category: 'BEEF & LAMB - لحم بقر وخروف', price: 47.83 },
  { name: 'Chili beef', name_en: 'Chili beef', category: 'BEEF & LAMB - لحم بقر وخروف', price: 38.26 },
  { name: 'Hunan beef', name_en: 'Hunan beef', category: 'BEEF & LAMB - لحم بقر وخروف', price: 38.26 },
  { name: 'Lamb chop curry', name_en: 'Lamb chop curry', category: 'BEEF & LAMB - لحم بقر وخروف', price: 41.74 },
  { name: 'Lamb & leek', name_en: 'Lamb & leek', category: 'BEEF & LAMB - لحم بقر وخروف', price: 38.26 },
  { name: 'Lamb roast', name_en: 'Lamb roast', category: 'BEEF & LAMB - لحم بقر وخروف', price: 47.83 },
  { name: 'Orange beef', name_en: 'Orange beef', category: 'BEEF & LAMB - لحم بقر وخروف', price: 38.26 },
  { name: 'S & S beef', name_en: 'S & S beef', category: 'BEEF & LAMB - لحم بقر وخروف', price: 38.26 },

  // CHARCOLA GRILL / KEBABS - المشويات
  { name: 'Abdi Chicken Kebab', name_en: 'Abdi Chicken Kebab', category: 'CHARCOLA GRILL / KEBABS - المشويات', price: 27.83 },
  { name: 'Afgani Chicken Kebab', name_en: 'Afgani Chicken Kebab', category: 'CHARCOLA GRILL / KEBABS - المشويات', price: 27.83 },
  { name: 'Angara Chicken Kebab', name_en: 'Angara Chicken Kebab', category: 'CHARCOLA GRILL / KEBABS - المشويات', price: 38.26 },
  { name: 'Angara Mutton Kebab', name_en: 'Angara Mutton Kebab', category: 'CHARCOLA GRILL / KEBABS - المشويات', price: 38.26 },
  { name: 'Chicken Hariali Kebab', name_en: 'Chicken Hariali Kebab', category: 'CHARCOLA GRILL / KEBABS - المشويات', price: 38.26 },
  { name: 'Chicken Kalmi Kebab', name_en: 'Chicken Kalmi Kebab', category: 'CHARCOLA GRILL / KEBABS - المشويات', price: 38.26 },
  { name: 'Chicken Makmali Kebab', name_en: 'Chicken Makmali Kebab', category: 'CHARCOLA GRILL / KEBABS - المشويات', price: 38.26 },
  { name: 'Chicken Malai Kebab', name_en: 'Chicken Malai Kebab', category: 'CHARCOLA GRILL / KEBABS - المشويات', price: 40.00 },
  { name: 'Chicken Sish Kebab', name_en: 'Chicken Sish Kebab', category: 'CHARCOLA GRILL / KEBABS - المشويات', price: 38.26 },
  { name: 'Chicken Tangri Kebab', name_en: 'Chicken Tangri Kebab', category: 'CHARCOLA GRILL / KEBABS - المشويات', price: 21.74 },
  { name: 'Chickntika (1/2)', name_en: 'Chickntika (1/2)', category: 'CHARCOLA GRILL / KEBABS - المشويات', price: 27.83 },
  { name: 'Chickntika (full)', name_en: 'Chickntika (full)', category: 'CHARCOLA GRILL / KEBABS - المشويات', price: 40.00 },
  { name: 'Fish boti', name_en: 'Fish boti', category: 'CHARCOLA GRILL / KEBABS - المشويات', price: 38.26 },
  { name: 'Fish Tikka', name_en: 'Fish Tikka', category: 'CHARCOLA GRILL / KEBABS - المشويات', price: 38.26 },
  { name: 'Grilled Prawn', name_en: 'Grilled Prawn', category: 'CHARCOLA GRILL / KEBABS - المشويات', price: 41.74 },
  { name: 'Grilled fish (L)', name_en: 'Grilled fish (L)', category: 'CHARCOLA GRILL / KEBABS - المشويات', price: 69.57 },
  { name: 'Grilled fish (M)', name_en: 'Grilled fish (M)', category: 'CHARCOLA GRILL / KEBABS - المشويات', price: 60.87 },
  { name: 'Lamb chop', name_en: 'Lamb chop', category: 'CHARCOLA GRILL / KEBABS - المشويات', price: 41.74 },
  { name: 'Mixed grill', name_en: 'Mixed grill', category: 'CHARCOLA GRILL / KEBABS - المشويات', price: 47.83 },
  { name: 'Mutton Hariali Kebab', name_en: 'Mutton Hariali Kebab', category: 'CHARCOLA GRILL / KEBABS - المشويات', price: 38.26 },
  { name: 'Mutton Laziz Tikka', name_en: 'Mutton Laziz Tikka', category: 'CHARCOLA GRILL / KEBABS - المشويات', price: 40.00 },
  { name: 'Samrat Kebab', name_en: 'Samrat Kebab', category: 'CHARCOLA GRILL / KEBABS - المشويات', price: 38.26 },

  // CHICKEN - دجاج
  { name: 'Chicken garlic', name_en: 'Chicken garlic', category: 'CHICKEN - دجاج', price: 38.26 },
  { name: 'Chkn 65', name_en: 'Chkn 65', category: 'CHICKEN - دجاج', price: 38.26 },
  { name: 'Chkn bambo', name_en: 'Chkn bambo', category: 'CHICKEN - دجاج', price: 38.26 },
  { name: 'Chkn chili onion', name_en: 'Chkn chili onion', category: 'CHICKEN - دجاج', price: 38.26 },
  { name: 'Fried chicken', name_en: 'Fried chicken', category: 'CHICKEN - دجاج', price: 38.26 },
  { name: 'Kongpo chicken', name_en: 'Kongpo chicken', category: 'CHICKEN - دجاج', price: 38.26 },
  { name: 'Manchurian chicken', name_en: 'Manchurian chicken', category: 'CHICKEN - دجاج', price: 38.26 },
  { name: 'Peking chicken', name_en: 'Peking chicken', category: 'CHICKEN - دجاج', price: 38.26 },
  { name: 'Pineapple chicken', name_en: 'Pineapple chicken', category: 'CHICKEN - دجاج', price: 38.26 },
  { name: 'Sz. chili chicken', name_en: 'Sz. chili chicken', category: 'CHICKEN - دجاج', price: 38.26 },
  { name: 'Thai chicken', name_en: 'Thai chicken', category: 'CHICKEN - دجاج', price: 38.26 },

  // CHINESE SIZZLING - طبق ساخن
  { name: 'Chicken/beef balti', name_en: 'Chicken/beef balti', category: 'CHINESE SIZZLING - طبق ساخن', price: 45.22 },
  { name: 'Duck sizzling', name_en: 'Duck sizzling', category: 'CHINESE SIZZLING - طبق ساخن', price: 50.43 },
  { name: 'Mix balti', name_en: 'Mix balti', category: 'CHINESE SIZZLING - طبق ساخن', price: 50.43 },
  { name: 'Prawn balti', name_en: 'Prawn balti', category: 'CHINESE SIZZLING - طبق ساخن', price: 50.43 },
  { name: 'Seafood sizzling', name_en: 'Seafood sizzling', category: 'CHINESE SIZZLING - طبق ساخن', price: 50.43 },
  { name: 'Sizzling beef', name_en: 'Sizzling beef', category: 'CHINESE SIZZLING - طبق ساخن', price: 45.22 },
  { name: 'Sizzling chicken', name_en: 'Sizzling chicken', category: 'CHINESE SIZZLING - طبق ساخن', price: 45.22 },
  { name: 'Sizzling fish', name_en: 'Sizzling fish', category: 'CHINESE SIZZLING - طبق ساخن', price: 46.09 },
  { name: 'Sizzling mix', name_en: 'Sizzling mix', category: 'CHINESE SIZZLING - طبق ساخن', price: 50.43 },
  { name: 'Sizzling prawn', name_en: 'Sizzling prawn', category: 'CHINESE SIZZLING - طبق ساخن', price: 50.43 },

  // Drinks - المشروبات
  { name: 'Banana split', name_en: 'Banana split', category: 'Drinks - المشروبات', price: 13.91 },
  { name: 'Champagne (L)', name_en: 'Champagne (L)', category: 'Drinks - المشروبات', price: 50.43 },
  { name: 'Champagne (M)', name_en: 'Champagne (M)', category: 'Drinks - المشروبات', price: 40.00 },
  { name: 'Champagne (S)', name_en: 'Champagne (S)', category: 'Drinks - المشروبات', price: 20.00 },
  { name: 'Coca Cola', name_en: 'Coca Cola', category: 'Drinks - المشروبات', price: 5.22 },
  { name: 'Cocktail juice', name_en: 'Cocktail juice', category: 'Drinks - المشروبات', price: 13.91 },
  { name: 'Fruit salad ice cream', name_en: 'Fruit salad ice cream', category: 'Drinks - المشروبات', price: 13.04 },
  { name: 'Fruit salad', name_en: 'Fruit salad', category: 'Drinks - المشروبات', price: 13.04 },
  { name: 'Ice cream', name_en: 'Ice cream', category: 'Drinks - المشروبات', price: 10.43 },
  { name: 'Iced tea (L)', name_en: 'Iced tea (L)', category: 'Drinks - المشروبات', price: 24.35 },
  { name: 'Iced tea (M)', name_en: 'Iced tea (M)', category: 'Drinks - المشروبات', price: 20.00 },
  { name: 'Iced tea (S)', name_en: 'Iced tea (S)', category: 'Drinks - المشروبات', price: 14.78 },
  { name: 'Orange juice', name_en: 'Orange juice', category: 'Drinks - المشروبات', price: 13.91 },
  { name: 'Pepsi', name_en: 'Pepsi', category: 'Drinks - المشروبات', price: 5.22 },
  { name: 'Tea/coffee', name_en: 'Tea/coffee', category: 'Drinks - المشروبات', price: 3.48 },
  { name: 'Water large', name_en: 'Water large', category: 'Drinks - المشروبات', price: 4.35 },
  { name: 'Water small', name_en: 'Water small', category: 'Drinks - المشروبات', price: 1.74 },

  // HOUSE SPECIAL - مخصوص للبيت
  { name: 'Duck roast', name_en: 'Duck roast', category: 'HOUSE SPECIAL - مخصوص للبيت', price: 52.17 },
  { name: 'Fried duck', name_en: 'Fried duck', category: 'HOUSE SPECIAL - مخصوص للبيت', price: 50.43 },
  { name: 'King lobster', name_en: 'King lobster', category: 'HOUSE SPECIAL - مخصوص للبيت', price: 100.00 },
  { name: 'Peking duck', name_en: 'Peking duck', category: 'HOUSE SPECIAL - مخصوص للبيت', price: 50.43 },
  { name: 'R Tiger lobster', name_en: 'R Tiger lobster', category: 'HOUSE SPECIAL - مخصوص للبيت', price: 180.00 },
  { name: 'Tiger lobster', name_en: 'Tiger lobster', category: 'HOUSE SPECIAL - مخصوص للبيت', price: 140.00 },
  { name: 'Whole sea lobster', name_en: 'Whole sea lobster', category: 'HOUSE SPECIAL - مخصوص للبيت', price: 85.22 },

  // INDIAN DELICACY (CHICKEN) - دجاج هندي
  { name: 'Bhuna', name_en: 'Bhuna', category: 'INDIAN DELICACY (CHICKEN) - دجاج هندي', price: 38.26 },
  { name: 'Butter chicken', name_en: 'Butter chicken', category: 'INDIAN DELICACY (CHICKEN) - دجاج هندي', price: 40.00 },
  { name: 'Butter dal', name_en: 'Butter dal', category: 'INDIAN DELICACY (CHICKEN) - دجاج هندي', price: 26.96 },
  { name: 'Chicken curry', name_en: 'Chicken curry', category: 'INDIAN DELICACY (CHICKEN) - دجاج هندي', price: 38.26 },
  { name: 'Chkn 65', name_en: 'Chkn 65', category: 'INDIAN DELICACY (CHICKEN) - دجاج هندي', price: 38.26 },
  { name: 'Chkn masala', name_en: 'Chkn masala', category: 'INDIAN DELICACY (CHICKEN) - دجاج هندي', price: 38.26 },
  { name: 'Chkn roast', name_en: 'Chkn roast', category: 'INDIAN DELICACY (CHICKEN) - دجاج هندي', price: 38.26 },
  { name: 'Dal gosh', name_en: 'Dal gosh', category: 'INDIAN DELICACY (CHICKEN) - دجاج هندي', price: 38.26 },
  { name: 'Fish curry', name_en: 'Fish curry', category: 'INDIAN DELICACY (CHICKEN) - دجاج هندي', price: 38.26 },
  { name: 'Handi', name_en: 'Handi', category: 'INDIAN DELICACY (CHICKEN) - دجاج هندي', price: 40.00 },
  { name: 'Karai', name_en: 'Karai', category: 'INDIAN DELICACY (CHICKEN) - دجاج هندي', price: 40.00 },
  { name: 'Korma', name_en: 'Korma', category: 'INDIAN DELICACY (CHICKEN) - دجاج هندي', price: 38.26 },
  { name: 'Lambchop curry', name_en: 'Lambchop curry', category: 'INDIAN DELICACY (CHICKEN) - دجاج هندي', price: 41.74 },
  { name: 'Muglai prawn', name_en: 'Muglai prawn', category: 'INDIAN DELICACY (CHICKEN) - دجاج هندي', price: 69.57 },
  { name: 'Muglai whole fish (L)', name_en: 'Muglai whole fish (L)', category: 'INDIAN DELICACY (CHICKEN) - دجاج هندي', price: 69.57 },
  { name: 'Muglai whole fish (M)', name_en: 'Muglai whole fish (M)', category: 'INDIAN DELICACY (CHICKEN) - دجاج هندي', price: 60.87 },
  { name: 'Prawn masala', name_en: 'Prawn masala', category: 'INDIAN DELICACY (CHICKEN) - دجاج هندي', price: 41.74 },
  { name: 'Tarka dal', name_en: 'Tarka dal', category: 'INDIAN DELICACY (CHICKEN) - دجاج هندي', price: 26.09 },
  { name: 'Tikka masala', name_en: 'Tikka masala', category: 'INDIAN DELICACY (CHICKEN) - دجاج هندي', price: 40.00 },

  // INDIAN DELICACY (FISH) - سمك هندي
  { name: 'Fried whole fish (L)', name_en: 'Fried whole fish (L)', category: 'INDIAN DELICACY (FISH) - سمك هندي', price: 69.57 },
  { name: 'Fried whole fish (M)', name_en: 'Fried whole fish (M)', category: 'INDIAN DELICACY (FISH) - سمك هندي', price: 60.87 },
  { name: 'Fish ball', name_en: 'Fish ball', category: 'INDIAN DELICACY (FISH) - سمك هندي', price: 40.00 },
  { name: 'Fish chili onion', name_en: 'Fish chili onion', category: 'INDIAN DELICACY (FISH) - سمك هندي', price: 40.00 },
  { name: 'Fish in hot sauce', name_en: 'Fish in hot sauce', category: 'INDIAN DELICACY (FISH) - سمك هندي', price: 40.00 },
  { name: 'Fried fish', name_en: 'Fried fish', category: 'INDIAN DELICACY (FISH) - سمك هندي', price: 40.00 },
  { name: 'Szechuan fish', name_en: 'Szechuan fish', category: 'INDIAN DELICACY (FISH) - سمك هندي', price: 40.00 },
  { name: 'Shanhi smoked fish', name_en: 'Shanhi smoked fish', category: 'INDIAN DELICACY (FISH) - سمك هندي', price: 40.00 },
  { name: 'S&S fish', name_en: 'S&S fish', category: 'INDIAN DELICACY (FISH) - سمك هندي', price: 40.00 },
  { name: 'Steamed fish', name_en: 'Steamed fish', category: 'INDIAN DELICACY (FISH) - سمك هندي', price: 41.74 },

  // INDIAN DELICACY (VEGETABLES) - خضروات هندية
  { name: 'Alu motor', name_en: 'Alu motor', category: 'INDIAN DELICACY (VEGETABLES) - خضروات هندية', price: 27.83 },
  { name: 'Butter dal', name_en: 'Butter dal', category: 'INDIAN DELICACY (VEGETABLES) - خضروات هندية', price: 26.96 },
  { name: 'Chana masala', name_en: 'Chana masala', category: 'INDIAN DELICACY (VEGETABLES) - خضروات هندية', price: 27.83 },
  { name: 'Kaju matar', name_en: 'Kaju matar', category: 'INDIAN DELICACY (VEGETABLES) - خضروات هندية', price: 27.83 },
  { name: 'Mix veg', name_en: 'Mix veg', category: 'INDIAN DELICACY (VEGETABLES) - خضروات هندية', price: 30.43 },
  { name: 'Muglai veg', name_en: 'Muglai veg', category: 'INDIAN DELICACY (VEGETABLES) - خضروات هندية', price: 27.83 },
  { name: 'Okra masala', name_en: 'Okra masala', category: 'INDIAN DELICACY (VEGETABLES) - خضروات هندية', price: 27.83 },
  { name: 'Palak paneer', name_en: 'Palak paneer', category: 'INDIAN DELICACY (VEGETABLES) - خضروات هندية', price: 27.83 },
  { name: 'Tarka dal', name_en: 'Tarka dal', category: 'INDIAN DELICACY (VEGETABLES) - خضروات هندية', price: 26.09 },
  { name: 'Veg karai', name_en: 'Veg karai', category: 'INDIAN DELICACY (VEGETABLES) - خضروات هندية', price: 34.78 },
  { name: 'Veg kofta', name_en: 'Veg kofta', category: 'INDIAN DELICACY (VEGETABLES) - خضروات هندية', price: 27.83 },

  // NOODLES & CHOPSUEY - معكرونة
  { name: 'Chicken noodles', name_en: 'Chicken noodles', category: 'NOODLES & CHOPSUEY - معكرونة', price: 27.83 },
  { name: 'Chinese chopsuey', name_en: 'Chinese chopsuey', category: 'NOODLES & CHOPSUEY - معكرونة', price: 30.43 },
  { name: 'Fettuccini chicken', name_en: 'Fettuccini chicken', category: 'NOODLES & CHOPSUEY - معكرونة', price: 34.78 },
  { name: 'Mixed noodles', name_en: 'Mixed noodles', category: 'NOODLES & CHOPSUEY - معكرونة', price: 30.43 },
  { name: 'Penne prawn', name_en: 'Penne prawn', category: 'NOODLES & CHOPSUEY - معكرونة', price: 40.00 },
  { name: 'Seafood noodles', name_en: 'Seafood noodles', category: 'NOODLES & CHOPSUEY - معكرونة', price: 32.17 },
  { name: 'Stirred noodles', name_en: 'Stirred noodles', category: 'NOODLES & CHOPSUEY - معكرونة', price: 30.43 },
  { name: 'Szechuan noodles', name_en: 'Szechuan noodles', category: 'NOODLES & CHOPSUEY - معكرونة', price: 30.43 },
  { name: 'Veg noodles', name_en: 'Veg noodles', category: 'NOODLES & CHOPSUEY - معكرونة', price: 24.34 },

  // PRAWNS - ربيان
  { name: 'Carbon shell', name_en: 'Carbon shell', category: 'PRAWNS - ربيان', price: 47.83 },
  { name: 'Hunan prawn', name_en: 'Hunan prawn', category: 'PRAWNS - ربيان', price: 47.83 },
  { name: 'Mandarin prawn', name_en: 'Mandarin prawn', category: 'PRAWNS - ربيان', price: 50.43 },
  { name: 'Mongolian prawn', name_en: 'Mongolian prawn', category: 'PRAWNS - ربيان', price: 47.83 },
  { name: 'Peking prawn', name_en: 'Peking prawn', category: 'PRAWNS - ربيان', price: 47.83 },
  { name: 'Prawn garlic', name_en: 'Prawn garlic', category: 'PRAWNS - ربيان', price: 45.22 },
  { name: 'Prawn mushroom', name_en: 'Prawn mushroom', category: 'PRAWNS - ربيان', price: 46.96 },
  { name: 'Prawn nut', name_en: 'Prawn nut', category: 'PRAWNS - ربيان', price: 50.43 },
  { name: 'Special modern prawn', name_en: 'Special modern prawn', category: 'PRAWNS - ربيان', price: 69.57 },
  { name: 'S&S prawn', name_en: 'S&S prawn', category: 'PRAWNS - ربيان', price: 47.83 },

  // SALADS - سلطات
  { name: 'Chicken/prawn mayo', name_en: 'Chicken/prawn mayo', category: 'SALADS - سلطات', price: 20.00 },
  { name: 'Fattoush', name_en: 'Fattoush', category: 'SALADS - سلطات', price: 12.17 },
  { name: 'Grape leaves', name_en: 'Grape leaves', category: 'SALADS - سلطات', price: 12.17 },
  { name: 'Green salad', name_en: 'Green salad', category: 'SALADS - سلطات', price: 12.17 },
  { name: 'Hummus', name_en: 'Hummus', category: 'SALADS - سلطات', price: 10.43 },
  { name: 'Pangpang chicken', name_en: 'Pangpang chicken', category: 'SALADS - سلطات', price: 14.78 },
  { name: 'Prawn salad', name_en: 'Prawn salad', category: 'SALADS - سلطات', price: 20.00 },
  { name: 'Rainbow salad', name_en: 'Rainbow salad', category: 'SALADS - سلطات', price: 14.78 },
  { name: 'Samrat salad', name_en: 'Samrat salad', category: 'SALADS - سلطات', price: 20.00 },
  { name: 'Szechuan salad', name_en: 'Szechuan salad', category: 'SALADS - سلطات', price: 18.26 },
  { name: 'Shrimp cocktail', name_en: 'Shrimp cocktail', category: 'SALADS - سلطات', price: 20.00 },
  { name: 'Tabbula', name_en: 'Tabbula', category: 'SALADS - سلطات', price: 12.17 },

  // SHAW FAW - شاو فاو
  { name: 'Chicken shaw faw', name_en: 'Chicken shaw faw', category: 'SHAW FAW - شاو فاو', price: 45.22 },
  { name: 'Prawn shaw faw', name_en: 'Prawn shaw faw', category: 'SHAW FAW - شاو فاو', price: 50.43 },
  { name: 'Seafood shaw faw', name_en: 'Seafood shaw faw', category: 'SHAW FAW - شاو فاو', price: 50.43 },

  // SOUPS - شوربات
  { name: 'Chicken lemon soup', name_en: 'Chicken lemon soup', category: 'SOUPS - شوربات', price: 26.09 },
  { name: 'Chinese noodle soup', name_en: 'Chinese noodle soup', category: 'SOUPS - شوربات', price: 34.78 },
  { name: 'Corn soup', name_en: 'Corn soup', category: 'SOUPS - شوربات', price: 21.74 },
  { name: 'Cream of chicken', name_en: 'Cream of chicken', category: 'SOUPS - شوربات', price: 30.43 },
  { name: 'Dal soup', name_en: 'Dal soup', category: 'SOUPS - شوربات', price: 20.00 },
  { name: 'Duck soup', name_en: 'Duck soup', category: 'SOUPS - شوربات', price: 34.78 },
  { name: 'Hot & sour soup', name_en: 'Hot & sour soup', category: 'SOUPS - شوربات', price: 21.74 },
  { name: 'H/S bean curd', name_en: 'H/S bean curd', category: 'SOUPS - شوربات', price: 21.74 },
  { name: 'Lobster soup', name_en: 'Lobster soup', category: 'SOUPS - شوربات', price: 85.22 },
  { name: 'Mixed chicken soup', name_en: 'Mixed chicken soup', category: 'SOUPS - شوربات', price: 21.74 },
  { name: 'Prawn vegetable soup', name_en: 'Prawn vegetable soup', category: 'SOUPS - شوربات', price: 26.09 },
  { name: 'Seafood soup', name_en: 'Seafood soup', category: 'SOUPS - شوربات', price: 30.43 },
  { name: 'Steamed bottom seafood soup', name_en: 'Steamed bottom seafood soup', category: 'SOUPS - شوربات', price: 69.57 },
  { name: 'Thai soup', name_en: 'Thai soup', category: 'SOUPS - شوربات', price: 26.09 },
  { name: 'Tom yum soup', name_en: 'Tom yum soup', category: 'SOUPS - شوربات', price: 30.43 },
  { name: 'Wanton soup', name_en: 'Wanton soup', category: 'SOUPS - شوربات', price: 26.09 },
];

async function addMenuProductsViaAPI() {
  try {
    console.log('=== إضافة منتجات القائمة عبر API ===\n');
    console.log(`API Base: ${API_BASE}`);
    console.log(`عدد المنتجات: ${menuProducts.length}\n`);

    // Get token from environment or prompt user
    const token = process.env.API_TOKEN || '';
    if (!token) {
      console.error('❌ خطأ: يجب توفير API_TOKEN في متغيرات البيئة أو تسجيل الدخول أولاً');
      console.log('\n💡 يمكنك الحصول على token من خلال:');
      console.log('   1. تسجيل الدخول في المتصفح');
      console.log('   2. فتح Developer Tools > Application > Local Storage');
      console.log('   3. نسخ قيمة "token"');
      console.log('   4. تشغيل: export API_TOKEN="your_token_here" (Linux/Mac)');
      console.log('      أو: $env:API_TOKEN="your_token_here" (Windows PowerShell)');
      process.exit(1);
    }

    const axiosInstance = axios.create({
      baseURL: API_BASE,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    let added = 0;
    let skipped = 0;
    let errors = 0;

    for (const product of menuProducts) {
      try {
        // Prepare product data
        const productData = {
          name: product.name,
          name_en: product.name_en,
          category: product.category,
          price: product.price,
          cost: product.price * 0.7, // 70% of sale price
          tax_rate: 15,
          stock_quantity: 0,
          min_stock: 0,
          is_active: true
        };

        // Try to create product
        await axiosInstance.post('/products', productData);
        console.log(`✅ تمت الإضافة: ${product.name}`);
        added++;
      } catch (e) {
        const status = e.response?.status;
        const errorMsg = e.response?.data?.error || e.message || String(e);
        
        if (status === 409 || errorMsg.includes('duplicate') || errorMsg.includes('already exists')) {
          console.log(`⏭️  تم التخطي: ${product.name} (موجود بالفعل)`);
          skipped++;
        } else {
          console.error(`❌ خطأ في إضافة ${product.name}:`, errorMsg);
          if (errors < 3) {
            console.error('   Status:', status, 'Response:', e.response?.data);
          }
          errors++;
        }
      }
    }

    console.log('\n=== النتائج ===');
    console.log(`✅ تمت الإضافة: ${added}`);
    console.log(`⏭️  تم التخطي: ${skipped}`);
    console.log(`❌ أخطاء: ${errors}`);
    console.log(`📊 الإجمالي: ${menuProducts.length}`);

    console.log('\n✅ تم الانتهاء بنجاح!');
  } catch (e) {
    console.error('❌ خطأ عام:', e.message);
    console.error(e.stack);
    process.exit(1);
  }
}

addMenuProductsViaAPI();
