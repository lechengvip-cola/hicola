<template>
  <div class="setting">
    <el-collapse class="collapse" v-model="activeName" accordion>
      <el-collapse-item title="个性壁纸" name="1">
        <div class="bg-set">
          <el-radio-group v-model="coverType" text-color="#ffffff" @change="radioChange">
            <el-radio value="0" size="large" border>默认壁纸</el-radio>
            <el-radio value="1" size="large" border>每日一图</el-radio>
            <el-radio value="2" size="large" border>随机风景</el-radio>
            <el-radio value="3" size="large" border>随机动漫</el-radio>
          </el-radio-group>
        </div>
      </el-collapse-item>
      <el-collapse-item title="个性化调整" name="2">
        <div class="item">
          <span class="text">建站日期显示</span>
          <el-switch
            v-model="siteStartShow"
            inline-prompt
            :active-icon="CheckSmall"
            :inactive-icon="CloseSmall"
          />
        </div>
        <div class="item">
          <span class="text">音乐点击是否打开面板</span>
          <el-switch
            v-model="musicClick"
            inline-prompt
            :active-icon="CheckSmall"
            :inactive-icon="CloseSmall"
          />
        </div>
        <div class="item">
          <span class="text">底栏歌词显示</span>
          <el-switch
            v-model="playerLrcShow"
            inline-prompt
            :active-icon="CheckSmall"
            :inactive-icon="CloseSmall"
          />
        </div>
        <div class="item">
          <span class="text">底栏背景模糊</span>
          <el-switch
            v-model="footerBlur"
            inline-prompt
            :active-icon="CheckSmall"
            :inactive-icon="CloseSmall"
          />
        </div>
      </el-collapse-item>
      <el-collapse-item title="播放器配置" name="3">
        <div class="item">
          <span class="text">自动播放</span>
          <el-switch
            v-model="playerAutoplay"
            inline-prompt
            :active-icon="CheckSmall"
            :inactive-icon="CloseSmall"
          />
        </div>
        <div class="item">
          <span class="text">随机播放</span>
          <el-switch
            v-model="playerOrder"
            inline-prompt
            :active-icon="CheckSmall"
            :inactive-icon="CloseSmall"
            active-value="random"
            inactive-value="list"
          />
        </div>
        <div class="item">
          <span class="text">循环模式</span>
          <el-radio-group v-model="playerLoop" size="small" text-color="#FFFFFF">
            <el-radio value="all" border>列表</el-radio>
            <el-radio value="one" border>单曲</el-radio>
            <el-radio value="none" border>不循环</el-radio>
          </el-radio-group>
        </div>
      </el-collapse-item>
      <el-collapse-item title="其他设置" name="4">
        <div class="vacation-setting">
          <div class="vacation-title">假期倒计时</div>
          <div class="date-row">
            <span class="date-label">寒假</span>
            <label>
              <small>开始</small>
              <input v-model="winterVacationStart" type="date" />
            </label>
            <label>
              <small>结束</small>
              <input v-model="winterVacationEnd" type="date" />
            </label>
          </div>
          <div class="date-row">
            <span class="date-label">暑假</span>
            <label>
              <small>开始</small>
              <input v-model="summerVacationStart" type="date" />
            </label>
            <label>
              <small>结束</small>
              <input v-model="summerVacationEnd" type="date" />
            </label>
          </div>
          <p class="date-tip">保存后会自动显示在“成长刻度”的时光胶囊里。</p>
        </div>
      </el-collapse-item>
    </el-collapse>
  </div>
</template>

<script setup>
import { CheckSmall, CloseSmall, SuccessPicture } from "@icon-park/vue-next";
import { mainStore } from "@/store";
import { storeToRefs } from "pinia";

const store = mainStore();
const {
  coverType,
  siteStartShow,
  musicClick,
  playerLrcShow,
  footerBlur,
  playerAutoplay,
  playerOrder,
  playerLoop,
  winterVacationStart,
  winterVacationEnd,
  summerVacationStart,
  summerVacationEnd,
} = storeToRefs(store);

// 默认选中项
const activeName = ref("1");

// 壁纸切换
const radioChange = () => {
  ElMessage({
    message: "壁纸更换成功",
    icon: h(SuccessPicture, {
      theme: "filled",
      fill: "#efefef",
    }),
  });
};
</script>

<style lang="scss" scoped>
.setting {
  .collapse {
    border-radius: 8px;
    --el-collapse-content-bg-color: #ffffff10;
    border-color: transparent;
    overflow: hidden;

    :deep(.el-collapse-item__header) {
      background-color: #ffffff30;
      color: #fff;
      font-size: 15px;
      padding-left: 18px;
      border-color: transparent;
    }

    :deep(.el-collapse-item__wrap) {
      border-color: transparent;

      .el-collapse-item__content {
        padding: 20px;
        .item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          font-size: 14px;
          .el-switch__core {
            border-color: transparent;
            background-color: #ffffff30;
          }
          .el-radio-group {
            .el-radio {
              margin: 2px 10px 2px 0;
              border-radius: 5px;

              &:last-child {
                margin-right: 0;
              }
            }
          }
        }

        .vacation-setting {
          .vacation-title {
            margin-bottom: 0.8rem;
            font-size: 14px;
            font-weight: 700;
          }

          .date-row {
            margin-bottom: 0.75rem;
            display: grid;
            grid-template-columns: 46px 1fr 1fr;
            gap: 0.65rem;
            align-items: end;

            .date-label {
              padding-bottom: 0.45rem;
              font-size: 14px;
              font-weight: 700;
            }

            label {
              min-width: 0;
              display: flex;
              flex-direction: column;
              gap: 0.28rem;

              small {
                color: rgb(255 255 255 / 66%);
                font-size: 12px;
              }

              input {
                width: 100%;
                height: 34px;
                padding: 0 0.55rem;
                border: 1px solid transparent;
                border-radius: 6px;
                outline: none;
                color: #fff;
                font-family: "HarmonyOS_Regular", sans-serif;
                background: rgb(255 255 255 / 18%);

                &:focus {
                  border-color: rgb(255 255 255 / 72%);
                  background: rgb(255 255 255 / 24%);
                }
              }
            }
          }

          .date-tip {
            margin-top: 0.3rem;
            color: rgb(255 255 255 / 62%);
            line-height: 1.5;
            font-size: 12px;
          }
        }
        .el-radio-group {
          justify-content: space-between;

          .el-radio {
            margin: 10px 16px;
            background: #ffffff26;
            border: 2px solid transparent;
            border-radius: 8px;

            .el-radio__label {
              color: #fff;
            }

            .el-radio__inner {
              background: #ffffff06 !important;
              border: 2px solid #eeeeee !important;
            }

            &.is-checked {
              background: #ffffff06 !important;
              border: 2px solid #eeeeee !important;
            }

            .is-checked {
              .el-radio__inner {
                background-color: #ffffff30 !important;
                border-color: #fff !important;
              }

              & + .el-radio__label {
                color: #fff !important;
              }
            }
          }
        }
      }
    }
  }
}
</style>
