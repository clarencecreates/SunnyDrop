import { defineConfig } from '@playwright/test';
export default defineConfig({testDir:'./e2e',timeout:90000,use:{browserName:'webkit',baseURL:'http://127.0.0.1:1421',viewport:{width:1440,height:1000},screenshot:'only-on-failure',video:'retain-on-failure'},reporter:'list'});
